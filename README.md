# zappi-allowance-spender

Separate program from `zappi-signer`. It creates its own Spark seed, seals that seed on this machine, and pulls USDB from a Spark token allowance. It never sees a pot phrase, and it does not install or upgrade the signer.

The command is installed from the Zappi site. Do not run it through `npx`.

Requires Node.js 20.9 or newer. Spark is mainnet, account 1. Staging (`dev.zappi.money`) uses that same network.

## Install

macOS and Linux:

```bash
curl -fsSL https://zappi.money/spender/install | sh
```

Staging:

```bash
curl -fsSL https://dev.zappi.money/spender/install | sh
```

Windows:

```powershell
irm https://zappi.money/spender/windows | iex
```

Staging on Windows uses `https://dev.zappi.money/spender/windows`.

The installer downloads this package from that same site, checks the SHA-256 pinned in the script, installs the Spark SDK for this machine, and links `zappi-allowance-spender`. It does not edit `mcp.json`, does not create a pot, and does not touch `~/.zappi-signer`.

## Commands

```bash
zappi-allowance-spender version
zappi-allowance-spender pubkey
zappi-allowance-spender pull \
  --allowance-id <32 hex chars> \
  --owner-public-key <66 hex chars> \
  --token-identifier <64 hex chars> \
  --receiver-public-key <66 hex chars> \
  --amount <token units>
```

`pubkey` creates the spender the first time and prints the 33-byte public key. `pull` spends an allowance that key already holds. Amount is a whole number of token units. `pull` prints a transaction id.

The seal lives in `~/.zappi-allowance-spender` (`phrase.enc` and `unwrap.key`, directory mode `0700`, files mode `0600`). The program itself is installed under `app/` in that directory and does not overwrite the seal. Set `ZAPPI_ALLOWANCE_SPENDER_DIR` to use another directory.

Platform notes are in [docs/platforms.md](docs/platforms.md).

## Develop

```bash
npm install
npm test
```
