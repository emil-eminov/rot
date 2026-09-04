/**
 * Packs the built game into one self-contained HTML fragment.
 *
 * Emits a fragment, not a document: the artifact host wraps it in its own
 * doctype, head and body.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const dist = process.env.ROT_DIST ?? join(homedir(), 'rot-build', 'dist')
const out = process.argv[2] ?? join(dist, 'rot.html')

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const match = html.match(/src="([^"]+\.js)"/)
if (!match) throw new Error(`No script tag found in ${join(dist, 'index.html')}`)

const bundle = readFileSync(join(dist, match[1].replace(/^\.\//, '')), 'utf8')
const safe = bundle.replaceAll('</script', '<\\/script')

writeFileSync(
  out,
  `<title>Rot</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: #0a0c0b; }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; }
</style>
<canvas id="stage"></canvas>
<script type="module">${safe}</script>
`,
)

const bytes = Buffer.byteLength(readFileSync(out))
console.log(`${out}  ${(bytes / 1024).toFixed(0)} KB`)
