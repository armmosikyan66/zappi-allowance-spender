import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { openPhrase, sealPhrase, writeSealedPhrase, readSealedPhrase, sealPaths } from './seal.js'

describe('seal', () => {
  it('round-trips a phrase and keeps the unwrap key in a second file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zappi-spender-'))
    const phrase = 'local spender seal test'
    await writeSealedPhrase(dir, phrase)
    const opened = await readSealedPhrase(dir)
    assert.equal(opened, phrase)
    const paths = sealPaths(dir)
    const sealed = await readFile(paths.phrase)
    const key = await readFile(paths.unwrap)
    assert.equal(sealed.includes(Buffer.from(phrase)), false)
    assert.equal(key.equals(sealed), false)
    assert.equal(openPhrase(sealed, key), phrase)
  })
})
