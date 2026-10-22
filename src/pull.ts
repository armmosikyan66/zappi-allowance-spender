export interface AllowancePullInput {
  allowanceId: string
  ownerPublicKey: string
  tokenIdentifier: string
  receiverPublicKey: string
  tokenAmount: bigint
}

export interface AllowancePullPrepared {
  partialHash: string
}

export interface AllowancePullWallet {
  startAllowancePull(
    params: AllowancePullInput & {
      outputs: Array<{ receiverPublicKey: string; tokenAmount: bigint }>
    },
  ): Promise<AllowancePullPrepared & { prepared: unknown }>
  commitAllowancePull(prepared: unknown): Promise<{ txId: string }>
}

/**
 * Spender-side pull. The pot phrase is not an input. An operator refusal
 * is returned as the error message. The same prepared pull is what
 * commitAllowancePull replays.
 */
export async function pullAllowance(
  wallet: AllowancePullWallet,
  input: AllowancePullInput,
): Promise<{ txId: string }> {
  assertHex(input.allowanceId, 16, 'allowance id')
  assertHex(input.ownerPublicKey, 33, 'owner public key')
  assertHex(input.tokenIdentifier, 32, 'token identifier')
  assertHex(input.receiverPublicKey, 33, 'receiver public key')
  if (input.tokenAmount < 1n) {
    throw new Error('Amount must be greater than zero.')
  }
  const started = await wallet.startAllowancePull({
    allowanceId: input.allowanceId,
    ownerPublicKey: input.ownerPublicKey,
    tokenIdentifier: input.tokenIdentifier,
    receiverPublicKey: input.receiverPublicKey,
    tokenAmount: input.tokenAmount,
    outputs: [
      {
        receiverPublicKey: input.receiverPublicKey,
        tokenAmount: input.tokenAmount,
      },
    ],
  })
  const committed = await wallet.commitAllowancePull(started.prepared)
  if (!committed.txId.trim()) {
    throw new Error(
      'The pull settled without a transaction id. Do not send it again.',
    )
  }
  return { txId: committed.txId.trim() }
}

function assertHex(value: string, bytes: number, label: string): void {
  const hex = value.trim().toLowerCase()
  if (hex.length !== bytes * 2 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error(`The ${label} must be ${bytes} bytes of hex.`)
  }
}
