import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parsePullArgs } from './cli.js'
import { pullAllowance, type AllowancePullWallet } from './pull.js'

const ALLOWANCE = 'ab'.repeat(16)
const OWNER = `02${'11'.repeat(32)}`
const TOKEN = '22'.repeat(32)
const RECEIVER = `03${'33'.repeat(32)}`

describe('pullAllowance', () => {
  it('starts and commits without a pot phrase', async () => {
    const calls: string[] = []
    const wallet: AllowancePullWallet = {
      startAllowancePull: async (params) => {
        calls.push('start')
        assert.equal('phrase' in params, false)
        assert.equal(params.tokenAmount, 10_000n)
        return { partialHash: 'aa', prepared: { partialHash: 'aa' } }
      },
      commitAllowancePull: async (prepared) => {
        calls.push('commit')
        assert.deepEqual(prepared, { partialHash: 'aa' })
        return { txId: 'bb'.repeat(32) }
      },
    }
    const result = await pullAllowance(wallet, {
      allowanceId: ALLOWANCE,
      ownerPublicKey: OWNER,
      tokenIdentifier: TOKEN,
      receiverPublicKey: RECEIVER,
      tokenAmount: 10_000n,
    })
    assert.deepEqual(calls, ['start', 'commit'])
    assert.equal(result.txId, 'bb'.repeat(32))
  })

  it('surfaces an operator refusal', async () => {
    const wallet: AllowancePullWallet = {
      startAllowancePull: async () => {
        throw new Error('token allowance has expired')
      },
      commitAllowancePull: async () => ({ txId: 'nope' }),
    }
    await assert.rejects(
      () =>
        pullAllowance(wallet, {
          allowanceId: ALLOWANCE,
          ownerPublicKey: OWNER,
          tokenIdentifier: TOKEN,
          receiverPublicKey: RECEIVER,
          tokenAmount: 1n,
        }),
      /expired/,
    )
  })
})

describe('parsePullArgs', () => {
  it('reads the public pull fields', () => {
    const parsed = parsePullArgs([
      '--allowance-id',
      ALLOWANCE,
      '--owner-public-key',
      OWNER,
      '--token-identifier',
      TOKEN,
      '--receiver-public-key',
      RECEIVER,
      '--amount',
      '10000',
    ])
    assert.equal(parsed.tokenAmount, 10_000n)
    assert.equal(parsed.allowanceId, ALLOWANCE)
  })
})
