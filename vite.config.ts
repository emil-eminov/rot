import { defineConfig } from 'vitest/config'

const OUT_DIR = process.env.ROT_DIST ?? 'dist'

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: OUT_DIR, emptyOutDir: true, assetsInlineLimit: 0 },
  test: { globals: true, environment: 'node', include: ['tests/**/[!_]*.test.ts'] },
})
