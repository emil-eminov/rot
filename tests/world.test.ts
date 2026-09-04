import { describe, expect, it } from 'vitest'
import { World, ARENA } from '../src/game/world'
import { TICK_SECONDS } from '../src/core/loop'
import { UPGRADES, availableUpgrades, xpForLevel } from '../src/game/upgrades'
import { botSteering } from '../src/game/bot'
import { HARMLESS_BELOW } from '../src/game/rot'

/**
 * Plays a full run with the scripted bot, taking the first upgrade offered.
 * Balance is only meaningful against a player who moves: a dummy that stands
 * still dies in eighteen seconds and never reaches a level up.
 */
function botRun(seed: number, maxSeconds = 900) {
  const world = new World(seed)
  let onRot = 0
  let ticks = 0
  for (let i = 0; i < maxSeconds * 60; i++) {
    world.step(TICK_SECONDS, botSteering(world))
    ticks += 1
    if (world.rot.at(world.player.x, world.player.y) > HARMLESS_BELOW) onRot += 1
    if (world.phase === 'CHOOSING') world.choose(world.choices[0]!)
    if (world.phase === 'DEAD') break
  }
  return { world, onRotFraction: onRot / ticks }
}

function run(world: World, seconds: number, move = { x: 0, y: 0 }): void {
  const ticks = Math.floor(seconds / TICK_SECONDS)
  for (let i = 0; i < ticks; i++) world.step(TICK_SECONDS, move)
}

describe('the run', () => {
  it('spawns enemies and kills them without being touched', () => {
    const world = new World(7)
    run(world, 12)
    expect(world.kills).toBeGreaterThan(0)
  })

  it('escalates: the swarm is denser later than it is early', () => {
    const world = new World(11)
    run(world, 15)
    const early = world.enemies.length
    run(world, 45)
    expect(world.enemies.length).toBeGreaterThan(early)
  })

  it('is deterministic for a given seed', () => {
    const a = new World(99)
    const b = new World(99)
    run(a, 25)
    run(b, 25)
    expect([a.kills, a.enemies.length, Math.round(a.player.hp)]).toEqual([
      b.kills,
      b.enemies.length,
      Math.round(b.player.hp),
    ])
  })

  it('poisons the ground as a direct result of killing, which is the hook', () => {
    const world = new World(5)
    expect(world.rot.coverage).toBe(0)
    run(world, 25)
    expect(world.kills).toBeGreaterThan(0)
    expect(world.rot.coverage).toBeGreaterThan(0)
  })

  it('kills a player who stands still forever', () => {
    const world = new World(3)
    run(world, 200)
    expect(world.phase).toBe('DEAD')
    expect(world.player.hp).toBe(0)
  })

  it('keeps the player inside the arena', () => {
    const world = new World(4)
    run(world, 30, { x: 1, y: 1 })
    expect(Math.abs(world.player.x)).toBeLessThanOrEqual(ARENA)
    expect(Math.abs(world.player.y)).toBeLessThanOrEqual(ARENA)
  })

  it('offers three upgrades on level up and stops the run until one is picked', () => {
    const world = new World(21)
    for (let i = 0; i < 60 * 120 && world.phase === 'PLAYING'; i++) {
      world.step(TICK_SECONDS, botSteering(world))
    }
    expect(world.phase).toBe('CHOOSING')
    expect(world.choices.length).toBe(3)
    const before = world.elapsed
    run(world, 2)
    expect(world.elapsed, 'time must not pass while choosing').toBe(before)
    world.choose(world.choices[0]!)
    expect(world.phase).toBe('PLAYING')
  })

  it('applies the chosen upgrade', () => {
    const world = new World(1)
    const damage = world.stats.damage
    world.phase = 'CHOOSING'
    world.choices = [UPGRADES.find((u) => u.id === 'damage')!]
    world.choose(world.choices[0]!)
    expect(world.stats.damage).toBeGreaterThan(damage)
  })

  it('never runs out of entity budget in a long run', () => {
    const world = new World(77)
    run(world, 240)
    expect(world.enemies.length).toBeLessThanOrEqual(260)
    expect(world.particles.length).toBeLessThanOrEqual(500)
  })
})

/**
 * These are the balance guards. They are deliberately wide: they catch a change
 * that breaks the game, not one that merely retunes it.
 */
describe('a competent run', () => {
  const seeds = [3, 7, 21, 42, 99]

  it('lasts long enough to be a run rather than an accident', () => {
    for (const seed of seeds) {
      const { world } = botRun(seed)
      expect(world.elapsed, `seed ${seed} ended after ${world.elapsed.toFixed(0)}s`).toBeGreaterThan(35)
      expect(world.elapsed, `seed ${seed} never ended`).toBeLessThan(900)
    }
  })

  it('reaches the first upgrade quickly, because that is where the run gets good', () => {
    const world = new World(7)
    let firstLevel: number | undefined
    for (let i = 0; i < 60 * 120; i++) {
      world.step(TICK_SECONDS, botSteering(world))
      if (world.phase === 'CHOOSING') {
        firstLevel ??= world.elapsed
        world.choose(world.choices[0]!)
      }
      if (world.phase === 'DEAD') break
    }
    expect(firstLevel, 'never levelled up').toBeDefined()
    expect(firstLevel!, `first level took ${firstLevel?.toFixed(0)}s`).toBeLessThan(30)
  })

  it('makes the player fight on their own poison, which is the entire hook', () => {
    // Measured at roughly 7 to 14% across seeds. An earlier decay rate left this
    // at zero, which made the game's premise invisible while every other test
    // still passed.
    for (const seed of seeds) {
      const { world, onRotFraction } = botRun(seed)
      expect(onRotFraction, `seed ${seed} spent ${(onRotFraction * 100).toFixed(1)}% on rot`).toBeGreaterThan(0.03)
      expect(world.rot.coverage, `seed ${seed} left no stains`).toBeGreaterThan(0)
    }
  })
})

describe('upgrades', () => {
  it('stops offering an upgrade once it has hit its cap', () => {
    const world = new World(1)
    const taken = { count: 5 }
    expect(availableUpgrades(world.stats, taken).some((u) => u.id === 'count')).toBe(false)
  })

  it('needs more xp for each level', () => {
    expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(1))
    expect(xpForLevel(20)).toBeGreaterThan(xpForLevel(5))
  })

  it('keeps fire rate above one shot per two ticks', () => {
    const world = new World(1)
    const faster = UPGRADES.find((u) => u.id === 'firerate')!
    for (let i = 0; i < 40; i++) faster.apply(world.stats)
    expect(world.stats.fireInterval).toBeGreaterThanOrEqual(0.07)
  })
})
