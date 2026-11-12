/** Copy the self-contained browser module into the installable package. */
import { copyFileSync, mkdirSync } from 'node:fs'

const output = new URL('../dist/', import.meta.url)
mkdirSync(output, { recursive: true })
copyFileSync(new URL('../src/client.js', import.meta.url), new URL('client.js', output))
