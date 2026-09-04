import { defineConfig } from '@playwright/test'

/**
 * Browser verification runs in the cloud sandbox, which has no GPU: headless
 * Chromium falls back to a software rasteriser. Wall-clock frame times there
 * are therefore meaningless and are NOT asserted. What is asserted here is
 * hardware-honest: physics step cost, draw calls, body counts, console errors.
 * Real frame rate is measured on a phone (SPEC 7).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    launchOptions: {
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
      // The sandbox ships a pinned Chromium that may not match the version
      // @playwright/test expects, and it cannot download another one. Point at
      // the provided binary instead of failing with "run playwright install".
      ...(process.env.ROT_CHROMIUM ? { executablePath: process.env.ROT_CHROMIUM } : {}),
    },
  },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
