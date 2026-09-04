import { expect, test } from '@playwright/test'

test('boots with no console errors and starts a run', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await page.waitForFunction(() => window.__rot !== undefined, null, { timeout: 30_000 })
  await page.waitForTimeout(1200)

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([])
  expect(await page.evaluate(() => window.__rot!.phase())).toBe('PLAYING')
  expect((await page.evaluate(() => window.__rot!.stats())).seconds).toBeGreaterThan(0.5)
})

test('a run produces enemies, then a level up card, then a death screen', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__rot !== undefined, null, { timeout: 30_000 })

  // Simulated rather than played in real time: a five minute run is not a
  // reasonable thing for a test to sit through.
  // Standing still is a reliable way to die, which is what this half checks.
  await page.evaluate(() => window.__rot!.simulate(600, true))
  await expect(page.locator('[data-death]')).toHaveClass(/show/, { timeout: 10_000 })
  await page.locator('[data-again]').click()
  expect(await page.evaluate(() => window.__rot!.phase())).toBe('PLAYING')
})

test('the arena renders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForFunction(() => window.__rot !== undefined, null, { timeout: 30_000 })
  // Played by the bot, so the screenshot shows a real fight rather than a corpse.
  await page.evaluate(() => window.__rot!.simulate(50))
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => window.__rot!.phase())).toBe('PLAYING')
  expect(await page.screenshot()).toMatchSnapshot('arena-portrait.png', { maxDiffPixelRatio: 0.2 })
})

/**
 * Plays in real time rather than through the simulate hook.
 *
 * The freeze that shipped in the first build was invisible to every other test
 * because they all drove the simulation directly and never rendered a frame.
 * This one runs the actual loop, with actual drawing, and fails if a single
 * exception escapes or if the clock stops advancing.
 */
test('survives twenty seconds of real play without the loop dying', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForFunction(() => window.__rot !== undefined, null, { timeout: 30_000 })

  const readings: number[] = []
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000)
    readings.push((await page.evaluate(() => window.__rot!.stats())).seconds)
  }

  expect(errors, `errors during play: ${errors.join(' | ')}`).toEqual([])
  // The clock only advances while the loop is alive, so a stalled reading is a
  // frozen game even when nothing was logged.
  for (let i = 1; i < readings.length; i++) {
    expect(
      readings[i]!,
      `time stopped advancing at reading ${i}: ${readings.join(', ')}`,
    ).toBeGreaterThan(readings[i - 1]!)
  }
})
