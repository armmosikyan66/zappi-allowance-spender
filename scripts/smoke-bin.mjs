#!/usr/bin/env node
/**
 * smoke-bin.mjs — run a built spender binary without touching a real seal.
 *
 *   node scripts/smoke-bin.mjs dist/bin/zappi-allowance-spender-darwin-arm64
 *   node scripts/smoke-bin.mjs <binary> 120000
 *
 * Checks `version`, then `pubkey` (Spark wallet init, no Zappi API).
 * Set ZAPPI_ALLOWANCE_SPENDER_SMOKE_SPARK=0 to skip pubkey.
 * HOME and ZAPPI_ALLOWANCE_SPENDER_DIR point at a scratch directory.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
const bin = process.argv[2]
const timeoutMs = Number(process.argv[3] || 120000)

if (!bin) {
  console.error('usage: node scripts/smoke-bin.mjs <binary> [timeoutMs]')
  process.exit(1)
}

function run(args, home, timeout) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        ZAPPI_ALLOWANCE_SPENDER_DIR: join(home, 'seal'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ code: 124, stdout, stderr: `${stderr}\ntimed out\n` })
    }, timeout)
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: 127, stdout, stderr: `${stderr}${error.message}\n` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

const home = mkdtempSync(join(tmpdir(), 'zappi-spender-smoke-'))
try {
  const version = await run(['version'], home, 30000)
  if (version.code !== 0 || version.stdout.trim() !== pkg.version) {
    console.error(version.stderr)
    throw new Error(`version failed: ${JSON.stringify(version.stdout.trim())}`)
  }
  const usage = await run([], home, 30000)
  if (usage.code === 0) throw new Error('a missing command should fail')
  if (!/version, pubkey, or pull/.test(usage.stderr)) {
    throw new Error(`unexpected usage stderr: ${usage.stderr.trim()}`)
  }
  if (process.env.ZAPPI_ALLOWANCE_SPENDER_SMOKE_SPARK === '0') {
    console.log(`smoke: ${pkg.version} ok (spark skipped)`)
  } else {
    const pub = await run(['pubkey'], home, timeoutMs)
    const key = pub.stdout.trim()
    if (pub.code !== 0 || !/^[0-9a-fA-F]{66}$/.test(key)) {
      console.error(pub.stderr)
      throw new Error(`pubkey failed (${pub.code}): ${key.slice(0, 120)}`)
    }
    console.log(`smoke: ${pkg.version} version and pubkey ok`)
  }
} catch (error) {
  console.error(`[smoke-bin] ${error && error.message ? error.message : error}`)
  process.exitCode = 1
} finally {
  rmSync(home, { recursive: true, force: true })
}
