# zappi-allowance-spender

It creates its own Spark seed, seals that seed on this machine, and pulls USDB from a Spark token allowance. It never sees a pot phrase.

The command is installed from the Zappi site. Do not run it through `npx`.

The installed command is a signed binary. It does not need Node.js or npm. Spark is mainnet, account 1. Staging (`dev.zappi.money`) uses that same network. Building a release still needs Node.js 20.9 or newer.

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

The installer downloads a signed binary for this machine from the pinned GitHub release, checks it, and links `zappi-allowance-spender`. It does not use npm. It does not edit `mcp.json` and does not create a pot. Release signing is in [docs/release.md](docs/release.md).

An agent installs this itself. It saves the script and runs that file, because a pipe into a shell is refused by agent hosts. It does not ask the human to install or to run `pubkey`. Staging uses `https://dev.zappi.money` in the same command.

```bash
curl -fsSL https://zappi.money/spender/install -o /tmp/zappi-spender-install.sh && sh /tmp/zappi-spender-install.sh
```

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

The seal lives in `~/.zappi-allowance-spender` (`phrase.enc` and `unwrap.key`, directory mode `0700`, files mode `0600`). The binary is installed under `bin/<version>/<target>/` in that directory and does not overwrite the seal. `~/.local/bin/zappi-allowance-spender` execs that binary. Set `ZAPPI_ALLOWANCE_SPENDER_DIR` to use another directory.

Platform notes are in [docs/platforms.md](docs/platforms.md).

## Develop

```bash
npm install
npm test
```
