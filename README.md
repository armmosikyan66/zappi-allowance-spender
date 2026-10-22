# @zappimoney/spark-allowance-spender

Local Spark allowance spender. It creates its own seed, seals that seed on this machine, and pulls USDB from a Spark token allowance. It never sees a pot phrase.

Requires Node.js 20.9 or newer.

```bash
npm install
npm test
```

`pubkey` creates the spender the first time and prints the 33-byte public key:

```bash
npx spark-allowance-spender pubkey
```

`pull` spends an allowance that key already holds. Amount is a whole number of token units.

```bash
npx spark-allowance-spender pull \
  --allowance-id <32 hex chars> \
  --owner-public-key <66 hex chars> \
  --token-identifier <64 hex chars> \
  --receiver-public-key <66 hex chars> \
  --amount <token units>
```

The seal lives in `~/.zappi-allowance-spender` (`phrase.enc` and `unwrap.key`, directory mode `0700`, files mode `0600`). Set `ZAPPI_ALLOWANCE_SPENDER_DIR` to use another directory. The wallet is Spark account 1 on mainnet.
