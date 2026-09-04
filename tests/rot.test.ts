import { describe, expect, it } from 'vitest'
import { CELL, HARMLESS_BELOW, RotField, rotDamagePerSecond, rotSpeedMultiplier } from '../src/game/rot'

describe('rot field', () => {
  it('stains the cell something died on, and splashes onto neighbours', () => {
    const field = new RotField(9, 9)
    field.stain(0, 0)
    expect(field.at(0, 0)).toBeGreaterThan(0.5)
    expect(field.at(CELL, 0)).toBeGreaterThan(0)
    expect(field.at(CELL * 3, 0)).toBe(0)
  })

  it('saturates rather than growing without limit', () => {
    const field = new RotField(9, 9)
    for (let i = 0; i < 20; i++) field.stain(0, 0)
    expect(field.at(0, 0)).toBeLessThanOrEqual(1)
  })

  it('fades over time, and faster with the Scour upgrade', () => {
    const slow = new RotField(9, 9)
    const fast = new RotField(9, 9)
    slow.stain(0, 0)
    fast.stain(0, 0)
    for (let i = 0; i < 60; i++) {
      slow.update(1 / 60, 1)
      fast.update(1 / 60, 3)
    }
    expect(fast.at(0, 0)).toBeLessThan(slow.at(0, 0))
    expect(slow.at(0, 0)).toBeLessThan(0.62)
  })

  it('never reports rot outside the grid, so the edge cannot poison anyone', () => {
    const field = new RotField(5, 5)
    expect(field.at(99999, 99999)).toBe(0)
    expect(() => field.stain(99999, 99999)).not.toThrow()
  })

  it('leaves a light stain harmless, so near misses do not feel unfair', () => {
    expect(rotDamagePerSecond(HARMLESS_BELOW)).toBe(0)
    expect(rotDamagePerSecond(HARMLESS_BELOW + 0.01)).toBeGreaterThan(0)
  })

  it('scales damage with depth and reduces it with resistance', () => {
    expect(rotDamagePerSecond(1)).toBeGreaterThan(rotDamagePerSecond(0.5))
    expect(rotDamagePerSecond(1, 0.5)).toBeCloseTo(rotDamagePerSecond(1) * 0.5, 5)
    expect(rotDamagePerSecond(1, 1)).toBe(0)
  })

  it('slows movement on rot but never stops it', () => {
    expect(rotSpeedMultiplier(0)).toBe(1)
    expect(rotSpeedMultiplier(1)).toBeLessThan(1)
    expect(rotSpeedMultiplier(1)).toBeGreaterThan(0.2)
  })
})
