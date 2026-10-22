import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const IV_BYTES = 12
const TAG_BYTES = 16

export function spenderDirectory(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.ZAPPI_ALLOWANCE_SPENDER_DIR?.trim()
  return configured && configured.length > 0
    ? configured
    : join(homedir(), '.zappi-allowance-spender')
}

export function sealPaths(dir: string): { phrase: string; unwrap: string } {
  return {
    phrase: join(dir, 'phrase.enc'),
    unwrap: join(dir, 'unwrap.key'),
  }
}

/** AES-256-GCM. The unwrap key is a separate file from the ciphertext. */
export function sealPhrase(phrase: string, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('The unwrap key must be 32 bytes.')
  }
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(phrase, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext])
}

export function openPhrase(sealed: Buffer, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error('The unwrap key must be 32 bytes.')
  }
  if (sealed.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('The sealed phrase is incomplete.')
  }
  const iv = sealed.subarray(0, IV_BYTES)
  const tag = sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = sealed.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  )
}

export async function readSealedPhrase(dir: string): Promise<string | null> {
  const paths = sealPaths(dir)
  try {
    const [sealed, key] = await Promise.all([
      readFile(paths.phrase),
      readFile(paths.unwrap),
    ])
    return openPhrase(sealed, key)
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

export async function writeSealedPhrase(dir: string, phrase: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await chmod(dir, 0o700)
  const key = randomBytes(32)
  const sealed = sealPhrase(phrase, key)
  const paths = sealPaths(dir)
  await writeFile(paths.unwrap, key, { mode: 0o600 })
  await writeFile(paths.phrase, sealed, { mode: 0o600 })
  await chmod(paths.unwrap, 0o600)
  await chmod(paths.phrase, 0o600)
  key.fill(0)
  sealed.fill(0)
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}
