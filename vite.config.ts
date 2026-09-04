import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Build output goes outside the synced project folder: it is mounted without
 * delete permission, so Vite cannot clear an out-dir inside it.
 */
const OUT_DIR = process.env.ROT_DIST ?? join(homedir(), 'rot-build', 'dist')

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: OUT_DIR, emptyOutDir: true, assetsInlineLimit: 0 },
  test: { globals: true, environment: 'node', include: ['tests/**/[!_]*.test.ts'] },
})
