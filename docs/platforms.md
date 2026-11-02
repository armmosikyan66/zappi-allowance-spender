# Platforms

`zappi-allowance-spender` is a signed standalone binary. The installer downloads the build for this machine. It does not use npm and it does not need Node.js. This spender has no keychain, no pot phrase, and no signer vault.

| Machine | Install | Command |
| --- | --- | --- |
| macOS arm64, macOS x64 | `curl -fsSL <origin>/spender/install \| sh` | `zappi-allowance-spender` |
| Linux arm64, Linux x64, glibc or musl | same shell installer | `zappi-allowance-spender` |
| Windows x64 | `irm <origin>/spender/windows \| iex` | `zappi-allowance-spender` |
| Windows arm64 | same Windows installer, x64 binary under emulation | `zappi-allowance-spender` |

`<origin>` is `https://zappi.money`, or `https://dev.zappi.money` when the agent is on staging. macOS and Linux need OpenSSL 3 to check the signature. LibreSSL cannot. Windows checks the SHA-256 pin in the script, and also checks the signature when OpenSSL 3 is installed. A phone has no shell for this program.

An agent does not use the pipe in that table. It saves `/spender/install` to `/tmp/zappi-spender-install.sh` and runs that file, or saves `/spender/windows` to `$env:TEMP\zappi-spender.ps1` and runs that file. It does not ask the human to install.

glibc Linux and the desktop targets are Node SEA binaries. musl Linux (Alpine, and many container images) is a Bun-compiled binary, because SEA cannot target musl. The release smoke runs that binary inside Alpine. The installer refuses any other OS or CPU.

The seal is a file pair, not a keychain item. On macOS and Linux the directory is mode `0700` and the files are mode `0600`. Windows keeps the same files under `%USERPROFILE%\.zappi-allowance-spender` and does not enforce those Unix modes.

Re-running the installer replaces `bin/<version>/<target>/` and the command link. `phrase.enc` and `unwrap.key` stay.
