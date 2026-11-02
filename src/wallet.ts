import { SparkWallet } from '@buildonspark/spark-sdk'
import type { AllowancePullWallet } from './pull.js'

const ACCOUNT_NUMBER = 1

type OpenedWallet = {
  getIdentityPublicKey(): Promise<string>
  startAllowancePull(params: unknown): Promise<unknown>
  commitAllowancePull(prepared: unknown): Promise<{ txId: string }>
  cleanup?: () => Promise<void>
  cleanupConnections?: () => Promise<void>
}

function spenderNetwork(): 'MAINNET' | 'REGTEST' {
  const value = (process.env.SPARK_NETWORK ?? '').trim().toUpperCase()
  if (value === '' || value === 'MAINNET') return 'MAINNET'
  if (value === 'REGTEST') return 'REGTEST'
  throw new Error('SPARK_NETWORK must be MAINNET or REGTEST.')
}

/**
 * Opens the spender seed for one call. Account 1 on SPARK_NETWORK
 * (unset is MAINNET). The caller zeroes the phrase buffer after this returns.
 */
export async function withSpenderWallet<T>(
  phrase: string,
  fn: (wallet: OpenedWallet) => Promise<T>,
): Promise<T> {
  const opened = await SparkWallet.initialize({
    mnemonicOrSeed: phrase,
    accountNumber: ACCOUNT_NUMBER,
    options: {
      network: spenderNetwork(),
      optimizationOptions: { auto: false, multiplicity: 0 },
      tokenOptimizationOptions: { enabled: false },
    },
  })
  const wallet = opened.wallet as OpenedWallet
  try {
    return await fn(wallet)
  } finally {
    await wallet.cleanup?.()
    await wallet.cleanupConnections?.()
  }
}

export function asPullWallet(wallet: OpenedWallet): AllowancePullWallet {
  return {
    startAllowancePull: async (params) => {
      const prepared = await wallet.startAllowancePull(params)
      const partial = prepared as { partialTokenTransactionHash?: Uint8Array }
      const hash = partial.partialTokenTransactionHash
      return {
        partialHash: hash ? Buffer.from(hash).toString('hex') : '',
        prepared,
      }
    },
    commitAllowancePull: (prepared) => wallet.commitAllowancePull(prepared),
  }
}
