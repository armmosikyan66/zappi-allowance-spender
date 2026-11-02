# Release

The signed binary is what `web/install/allowance-spender.sh` downloads. That
script is served at `https://zappi.money/spender/install`. It pins:

- `RELEASE_REPO` — `armmosikyan66/spark-allowance-spender`
- `RELEASE_TAG` — `zappi-allowance-spender-v<version>`
- `MIN_VERSION` and `PACKAGE_VERSION` — the same version, without the tag prefix
- `PUBLISHER_PUBKEY_PEM` — the Ed25519 public key, written in the installer.
  It is never fetched next to the binary.

Windows (`web/install/allowance-spender.ps1`) uses the same repo, tag, and
public key. It also pins `$WinX64Sha256`. That pin is 64 zeros until the
first win-x64 digest is copied in. Zeros fail closed.

## What a release contains

Per target (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`,
`linux-x64-musl`, `linux-arm64-musl`, `win-x64`):

| File | Meaning |
| --- | --- |
| `zappi-allowance-spender-<target>[.exe]` | Standalone binary. Node SEA, or Bun `--compile` for musl. |
| `<binary>.sig` | Base64 raw Ed25519 signature (64 bytes) |
| `<binary>.sha256` | Hex digest sidecar |
| `<binary>.provenance.json` | `version`, `target`, `commitSha`, `binarySha256`, `signedAt` |

There is no win-arm64 binary. Windows on ARM installs the win-x64 binary and
runs it under emulation.

The POSIX installer verifies the signature with `openssl pkeyutl -verify
-rawin` (OpenSSL 3, not LibreSSL), checks the SHA-256 in the provenance,
refuses a version below `MIN_VERSION`, and installs mode `0500`. Any failure
exits without running the file. `phrase.enc` and `unwrap.key` are not touched.

## Build and sign locally

```sh
npm run build:bin
ZAPPI_ALLOWANCE_SPENDER_RELEASE_KEY=... npm run sign:release -- --provenance
```

`scripts/build-bin.mjs` bundles `dist/cli.js`. If the Node graph of
`@buildonspark/spark-sdk` resolves a `.node` file, that file is embedded and
loaded from a private temp directory. The 0.12.1 Node build has no `.node`
addon. Musl targets need Bun (`TARGET=linux-x64-musl`). The compiled musl binary still needs `libstdc++` at runtime.

## Publish

Bump `package.json` first. The workflow refuses a tag that does not match
that version.

Push `zappi-allowance-spender-v<version>`.
`.github/workflows/zappi-allowance-spender-release.yml` builds every target,
runs tests, smoke-tests the binary (musl inside Alpine), signs with
`ZAPPI_ALLOWANCE_SPENDER_RELEASE_KEY`, and publishes the GitHub release.
Without the secret, no unsigned release is produced.

Then copy the printed win-x64 sha256 into `$WinX64Sha256` and deploy the
web app that serves the installers. macOS and Linux do not wait on that pin.

## The release key

- `ZAPPI_ALLOWANCE_SPENDER_RELEASE_KEY` is base64 of a 64-byte Ed25519 secret:
  `seed(32) || public-key(32)`. Generate it offline, store it as a GitHub
  repo secret, never commit or log it.
- Its public half must equal `PUBLISHER_PUBKEY_PEM` in both installers.
  Changing either is a coordinated change: new installer bytes plus a new
  release, published together.

Rotation:

1. Generate a new keypair offline.
2. Update the repo secret and `PUBLISHER_PUBKEY_PEM` together.
3. Cut a new installer and a new `zappi-allowance-spender-v*` release.
4. Put the new win-x64 sha256 in the Windows installer.

Old binaries fail verification under the new key. Remote MCP keeps working.
Autonomous allowance pulls pause until the spender is reinstalled.
