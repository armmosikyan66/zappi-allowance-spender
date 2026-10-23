# Platforms

`zappi-allowance-spender` is a Node program. One archive is served from the Zappi site. The installer then installs `@buildonspark/spark-sdk` for the machine it is running on, so the native pieces match that OS.

This is not the `zappi-signer` binary. That program builds a standalone executable per target (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win-x64`) and keeps a pot vault in the OS keychain. Its shell installer still refuses Windows. Those pieces do not belong in this program: this spender has no keychain, no pot phrase, and no signer vault.

| Machine | Install | Command |
| --- | --- | --- |
| macOS arm64, macOS x64 | `curl -fsSL <origin>/spender/install \| sh` | `zappi-allowance-spender` |
| Linux arm64, Linux x64 | same shell installer | `zappi-allowance-spender` |
| Windows x64, Windows arm64 | `irm <origin>/spender/windows \| iex` | `zappi-allowance-spender` |

`<origin>` is `https://zappi.money`, or `https://dev.zappi.money` when the agent is on staging. Node.js 20.9 or newer has to be installed first. A phone has no shell for this program.

The Spark SDK package used here ships `bare-tls` prebuilds for Linux and Windows, arm64 and x64. macOS gets its build from the same `npm install` on that Mac. The installer refuses any other OS or CPU.

The seal is a file pair, not a keychain item. On macOS and Linux the directory is mode `0700` and the files are mode `0600`. Windows keeps the same files under `%USERPROFILE%\.zappi-allowance-spender` and does not enforce those Unix modes.

Re-running the installer replaces `app/` only. `phrase.enc` and `unwrap.key` stay.
