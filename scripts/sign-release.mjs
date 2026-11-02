#!/usr/bin/env node
/**
 * sign-release.mjs — sign a zappi-allowance-spender release artifact.
 *
 *   node scripts/sign-release.mjs
 *   node scripts/sign-release.mjs dist/bin/zappi-allowance-spender-darwin-arm64 --provenance
 *
 * ZAPPI_ALLOWANCE_SPENDER_RELEASE_KEY is base64 of a 64-byte Ed25519 secret
 * (seed(32) || public-key(32)). It is a GitHub repo secret. Never commit it
 * and never log it. Without the key this script exits non-zero and writes
 * nothing.
 *
 * Outputs next to the file:
 *   <file>.sig              base64 raw Ed25519 signature (64 bytes)
 *   <file>.sha256           "<sha256> <basename>"
 *   <file>.provenance.json  when --provenance is set
 *
 * The installer checks the signature with `openssl pkeyutl -verify -rawin`
 * and reads `version` plus `binarySha256` from the provenance.
 */
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
  'linux-x64-musl',
  'linux-arm64-musl',
  'win-x64',
]

function detectTarget() {
  const env = process.env.TARGET?.trim()
  if (env) {
    if (!TARGETS.includes(env)) throw new Error(`Unknown TARGET "${env}"`)
    return env
  }
  const key = `${process.platform === 'win32' ? 'win' : process.platform}-${process.arch}`
  if (!TARGETS.includes(key)) throw new Error(`Unsupported host ${key}. Set TARGET explicitly.`)
  return key
}

function defaultBinary(target) {
  const ext = target === 'win-x64' ? '.exe' : ''
  return join(pkgRoot, 'dist', 'bin', `zappi-allowance-spender-${target}${ext}`)
}

function importPrivateKey(base64Key) {
  const raw = Buffer.from(base64Key, 'base64')
  if (raw.length !== 64) {
    throw new Error('ZAPPI_ALLOWANCE_SPENDER_RELEASE_KEY must be base64 of a 64-byte Ed25519 secret (seed||pub)')
  }
  return crypto.createPrivateKey({
    key: {
      kty: 'OKP',
      crv: 'Ed25519',
      d: raw.subarray(0, 32).toString('base64url'),
      x: raw.subarray(32, 64).toString('base64url'),
    },
    format: 'jwk',
  })
}

function readVersion() {
  const env = process.env.ZAPPI_ALLOWANCE_SPENDER_VERSION?.trim()
  const raw = env || JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version
  return String(raw).replace(/^zappi-allowance-spender-v/, '').replace(/^v/, '')
}

function readCommitSha() {
  const env = process.env.ZAPPI_ALLOWANCE_SPENDER_COMMIT_SHA?.trim()
  if (env) return env
  try {
    return execSync('git rev-parse HEAD', { cwd: pkgRoot }).toString().trim()
  } catch {
    return 'unknown'
  }
}

function fail(message) {
  console.error(`sign-release: ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const provenance = args.includes('--provenance')
const fileArg = args.find((arg) => !arg.startsWith('--'))
const target = detectTarget()
const file = fileArg ? (fileArg.includes('/') || fileArg.includes('\\') ? fileArg : join(process.cwd(), fileArg)) : defaultBinary(target)

if (!existsSync(file)) fail(`${file} not found. Run scripts/build-bin.mjs first.`)

const keyEnv = process.env.ZAPPI_ALLOWANCE_SPENDER_RELEASE_KEY?.trim()
if (!keyEnv) fail('ZAPPI_ALLOWANCE_SPENDER_RELEASE_KEY is not set. Refusing to produce an unsigned release.')

let privateKey
try {
  privateKey = importPrivateKey(keyEnv)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

const data = readFileSync(file)
const sig = crypto.sign(null, data, privateKey).toString('base64')
const sha256 = crypto.createHash('sha256').update(data).digest('hex')

writeFileSync(`${file}.sig`, `${sig}\n`)
writeFileSync(`${file}.sha256`, `${sha256} ${basename(file)}\n`)
console.log(`sign-release: signed ${file}`)
console.log(`sign-release: sha256 ${sha256}`)

if (provenance) {
  const record = {
    artifact: basename(file),
    version: readVersion(),
    target,
    commitSha: readCommitSha(),
    binarySha256: sha256,
    signedAt: new Date().toISOString(),
  }
  writeFileSync(`${file}.provenance.json`, `${JSON.stringify(record, null, 2)}\n`)
  console.log(`sign-release: wrote ${file}.provenance.json (version ${record.version})`)
}
