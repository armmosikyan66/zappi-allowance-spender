#!/usr/bin/env node
/**
 * build-bin.mjs — build one standalone zappi-allowance-spender binary.
 *
 *   node scripts/build-bin.mjs
 *   TARGET=linux-x64-musl node scripts/build-bin.mjs
 *
 * Requires `npm run build` (tsc -> dist/cli.js) first. `npm run build:bin`
 * does both.
 *
 * The Node graph of @buildonspark/spark-sdk 0.12.1 is JavaScript plus wasm
 * already inlined in the SDK bundle. Any `.node` addon that esbuild resolves
 * is embedded as base64 and dlopened from a private temp directory, because
 * the installed machine has no node_modules.
 *
 * Compile:
 * - Node SEA for darwin, glibc linux, and win-x64. SEA copies this process's
 *   node binary, so the runner architecture must match the target.
 * - Bun `--compile` for musl. SEA cannot target musl. Set
 *   ZAPPI_ALLOWANCE_SPENDER_BUN_COMPILE=1 to try Bun for a SEA target too.
 *
 * Output: dist/bin/zappi-allowance-spender-<target>[.exe] (mode 0500).
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(__dirname, '..')
const require = createRequire(import.meta.url)

const TARGETS = {
  'darwin-arm64': { bun: 'bun-darwin-arm64', ext: '', runtime: 'sea' },
  'darwin-x64': { bun: 'bun-darwin-x64', ext: '', runtime: 'sea' },
  'linux-x64': { bun: 'bun-linux-x64', ext: '', runtime: 'sea' },
  'linux-arm64': { bun: 'bun-linux-arm64', ext: '', runtime: 'sea' },
  'linux-x64-musl': { bun: 'bun-linux-x64-musl', ext: '', runtime: 'bun' },
  'linux-arm64-musl': { bun: 'bun-linux-arm64-musl', ext: '', runtime: 'bun' },
  'win-x64': { bun: 'bun-windows-x64', ext: '.exe', runtime: 'sea' },
}

const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

function detectTarget() {
  const env = process.env.TARGET?.trim()
  if (env) {
    if (!TARGETS[env]) {
      throw new Error(`Unknown TARGET "${env}". Supported: ${Object.keys(TARGETS).join(', ')}`)
    }
    return env
  }
  const key = `${process.platform === 'win32' ? 'win' : process.platform}-${process.arch}`
  if (!TARGETS[key]) throw new Error(`Unsupported host ${key}. Set TARGET explicitly.`)
  return key
}

function run(command, args, opts = {}) {
  const spawnOpts = { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts }
  if (process.platform === 'win32' && !/\.exe$/i.test(command)) spawnOpts.shell = true
  let result
  try {
    result = spawnSync(command, args, spawnOpts)
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    return { ok: false, missing: error && error.code === 'ENOENT', output: message }
  }
  const output = `${result.error ? `${result.error.message}\n` : ''}${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.error && result.error.code === 'ENOENT') return { ok: false, missing: true, output }
  return { ok: result.status === 0, output }
}

function nativeAddonPlugin(found) {
  return {
    name: 'embed-node-addons',
    setup(build) {
      build.onResolve({ filter: /\.node$/ }, (args) => {
        if (args.path.startsWith('.')) {
          return { path: join(args.resolveDir, args.path), namespace: 'node-addon' }
        }
        return { path: require.resolve(args.path, { paths: [args.resolveDir] }), namespace: 'node-addon' }
      })
      build.onLoad({ filter: /.*/, namespace: 'node-addon' }, (args) => {
        const bytes = readFileSync(args.path).toString('base64')
        found.push(args.path)
        return {
          contents: `'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const bytes = Buffer.from(${JSON.stringify(bytes)}, 'base64')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zappi-allowance-native-'))
const file = path.join(dir, 'addon.node')
fs.writeFileSync(file, bytes, { mode: 0o600 })
const mod = { exports: {} }
process.dlopen(mod, file)
module.exports = mod.exports
`,
          loader: 'js',
        }
      })
    },
  }
}

function codeSignatureOk(path, target) {
  if (!target.startsWith('darwin-')) return true
  return run('codesign', ['-dv', path]).ok
}

function buildSea(bundlePath, outPath, buildDir, target) {
  const seaConfig = join(buildDir, 'sea-config.json')
  const blob = join(buildDir, 'sea-prep.blob')
  writeFileSync(
    seaConfig,
    JSON.stringify({
      main: bundlePath,
      output: blob,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
    }),
  )
  const prep = run(process.execPath, ['--experimental-sea-config', seaConfig], { cwd: pkgRoot })
  if (!prep.ok || !existsSync(blob)) throw new Error(`sea-config failed:\n${prep.output}`)
  copyFileSync(process.execPath, outPath)
  const postjectBin = join(pkgRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'postject.cmd' : 'postject')
  if (!existsSync(postjectBin)) throw new Error('postject is missing. Run `npm install` in packages/zappi-allowance-spender.')
  const injectArgs = [outPath, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', SEA_FUSE]
  if (target.startsWith('darwin-')) injectArgs.push('--macho-segment-name', 'NODE_SEA')
  const inject = run(postjectBin, injectArgs)
  if (!inject.ok) throw new Error(`postject injection failed:\n${inject.output}`)
  if (target.startsWith('darwin-')) {
    const resign = run('codesign', ['--sign', '-', '--force', outPath])
    if (!resign.ok) throw new Error(`codesign failed:\n${resign.output}`)
  }
}

async function main() {
  const target = detectTarget()
  const { bun: bunTarget, ext, runtime } = TARGETS[target]
  const entry = join(pkgRoot, 'dist', 'cli.js')
  if (!existsSync(entry)) throw new Error('dist/cli.js is missing. Run `npm run build` first.')
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
  if (!pkg.version) throw new Error('package.json has no version')

  const buildDir = join(pkgRoot, 'dist', 'bin', '.build')
  mkdirSync(buildDir, { recursive: true })
  const bundlePath = join(buildDir, 'app.cjs')
  const esbuild = await import('esbuild').catch(() => null)
  if (!esbuild) throw new Error('esbuild is missing. Run `npm install` in packages/zappi-allowance-spender.')

  const nativeAddons = []
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: bundlePath,
    minify: false,
    sourcemap: false,
    conditions: ['node', 'import', 'require', 'default'],
    define: {
      'process.env.ZAPPI_ALLOWANCE_SPENDER_STANDALONE': '"1"',
      'process.env.ZAPPI_ALLOWANCE_SPENDER_EMBEDDED_VERSION': JSON.stringify(pkg.version),
    },
    plugins: [nativeAddonPlugin(nativeAddons)],
    loader: { '.wasm': 'binary', '.bare': 'binary' },
    logLevel: 'warning',
  })
  if (nativeAddons.length === 0) {
    console.log('[build-bin] no .node addons in the Node graph')
  } else {
    console.log(`[build-bin] embedded ${nativeAddons.length} .node addon(s)`)
  }

  const outPath = join(pkgRoot, 'dist', 'bin', `zappi-allowance-spender-${target}${ext}`)
  const forceBun = runtime === 'bun' || process.env.ZAPPI_ALLOWANCE_SPENDER_BUN_COMPILE === '1'
  let built = false
  if (forceBun) {
    rmSync(outPath, { force: true })
    const bun = run('bun', ['build', '--compile', `--target=${bunTarget}`, bundlePath, '--outfile', outPath])
    built = bun.ok && existsSync(outPath)
    if (built && target.startsWith('darwin-')) {
      run('codesign', ['--remove-signature', outPath])
      const resign = run('codesign', ['--sign', '-', '--force', outPath])
      built = resign.ok && codeSignatureOk(outPath, target)
    }
    if (built) console.log(`[build-bin] ${target}: bun --compile -> ${outPath}`)
    else if (runtime === 'bun') throw new Error(`bun --compile failed for ${target}:\n${bun.output}`)
    else console.warn('[build-bin] bun output unusable; falling back to Node SEA')
  }
  if (!built) {
    rmSync(outPath, { force: true })
    buildSea(bundlePath, outPath, buildDir, target)
    console.log(`[build-bin] ${target}: node SEA -> ${outPath}`)
  }

  chmodSync(outPath, 0o500)
  const sha = createHash('sha256').update(readFileSync(outPath)).digest('hex')
  console.log(`[build-bin] sha256: ${sha}`)
  console.log(`[build-bin] sign with: node scripts/sign-release.mjs dist/bin/zappi-allowance-spender-${target}${ext} --provenance`)
}

try {
  await main()
} catch (error) {
  console.error(`[build-bin] ${error && error.message ? error.message : error}`)
  process.exit(1)
}
