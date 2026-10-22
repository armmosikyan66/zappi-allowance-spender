#!/usr/bin/env node
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { pullAllowance, type AllowancePullInput } from './pull.js'
import { readSealedPhrase, spenderDirectory, writeSealedPhrase } from './seal.js'
import { asPullWallet, withSpenderWallet } from './wallet.js'

export async function ensureSpenderPhrase(dir: string): Promise<string> {
  const existing = await readSealedPhrase(dir)
  if (existing) return existing
  const phrase = generateMnemonic(wordlist, 128)
  await writeSealedPhrase(dir, phrase)
  return phrase
}

export async function printSpenderPublicKey(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const phrase = await ensureSpenderPhrase(spenderDirectory(env))
  const bytes = Buffer.from(phrase, 'utf8')
  try {
    return await withSpenderWallet(phrase, (wallet) =>
      wallet.getIdentityPublicKey(),
    )
  } finally {
    bytes.fill(0)
  }
}

export async function pullSpenderAllowance(
  input: AllowancePullInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const phrase = await readSealedPhrase(spenderDirectory(env))
  if (!phrase) {
    throw new Error('Run pubkey once so this machine has a spender key.')
  }
  const bytes = Buffer.from(phrase, 'utf8')
  try {
    const tx = await withSpenderWallet(phrase, (wallet) =>
      pullAllowance(asPullWallet(wallet), input),
    )
    return tx.txId
  } finally {
    bytes.fill(0)
  }
}

export function parsePullArgs(argv: string[]): AllowancePullInput {
  const read = (flag: string): string => {
    const index = argv.indexOf(flag)
    const value = index >= 0 ? argv[index + 1] : undefined
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing ${flag}.`)
    }
    return value
  }
  let tokenAmount: bigint
  try {
    tokenAmount = BigInt(read('--amount'))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing')) throw error
    throw new Error('Amount must be a whole number of token units.')
  }
  return {
    allowanceId: read('--allowance-id'),
    ownerPublicKey: read('--owner-public-key'),
    tokenIdentifier: read('--token-identifier'),
    receiverPublicKey: read('--receiver-public-key'),
    tokenAmount,
  }
}

async function main(argv: string[]): Promise<void> {
  const command = argv[0]
  if (command === 'pubkey') {
    const key = await printSpenderPublicKey()
    process.stdout.write(`${key}\n`)
    return
  }
  if (command === 'pull') {
    const txId = await pullSpenderAllowance(parsePullArgs(argv.slice(1)))
    process.stdout.write(`${txId}\n`)
    return
  }
  throw new Error('Use pubkey, or pull with the allowance id and amount.')
}

const isDirect = process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts')
if (isDirect) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Pull failed.'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}

export { main }
