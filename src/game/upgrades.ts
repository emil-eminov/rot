import type { Stats } from './types'

export interface Upgrade {
  readonly id: string
  readonly name: string
  /** One short line. Players read these in about a second, so they must be plain. */
  readonly detail: string
  readonly apply: (stats: Stats) => void
  /** Upgrades that only make sense once something else exists. */
  readonly available?: (stats: Stats) => boolean
  /** How many times this can be taken. */
  readonly max?: number
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'damage', name: 'Sharper', detail: '+35% damage', apply: (s) => void (s.damage *= 1.35) },
  {
    id: 'firerate',
    name: 'Faster',
    detail: '+20% fire rate',
    // Floor exists so fire rate cannot reach one shot per tick and drown the audio.
    apply: (s) => void (s.fireInterval = Math.max(0.07, s.fireInterval * 0.8)),
  },
  { id: 'count', name: 'Split', detail: '+1 shot', apply: (s) => void (s.bulletCount += 1), max: 5 },
  { id: 'pierce', name: 'Pierce', detail: 'shots pass through +1', apply: (s) => void (s.pierce += 1), max: 4 },
  { id: 'speed', name: 'Swift', detail: '+12% move speed', apply: (s) => void (s.moveSpeed *= 1.12) },
  { id: 'magnet', name: 'Draw', detail: '+60% pickup range', apply: (s) => void (s.magnet *= 1.6) },
  {
    id: 'resist',
    name: 'Hardened',
    detail: 'rot hurts 30% less',
    apply: (s) => void (s.rotResistance = Math.min(0.85, s.rotResistance + 0.3)),
    max: 3,
  },
  {
    id: 'decay',
    name: 'Scour',
    detail: 'rot fades 50% faster',
    apply: (s) => void (s.rotDecay += 0.5),
    max: 4,
  },
  { id: 'regen', name: 'Mend', detail: 'heal 1.5 hp per second', apply: (s) => void (s.regen += 1.5), max: 4 },
  {
    id: 'velocity',
    name: 'Hot Rounds',
    detail: '+30% shot speed',
    apply: (s) => void (s.bulletSpeed *= 1.3),
    max: 3,
  },
]

/** Upgrades still worth offering, given what has already been taken. */
export function availableUpgrades(stats: Stats, taken: Readonly<Record<string, number>>): Upgrade[] {
  return UPGRADES.filter((upgrade) => {
    if (upgrade.max !== undefined && (taken[upgrade.id] ?? 0) >= upgrade.max) return false
    return upgrade.available ? upgrade.available(stats) : true
  })
}

/**
 * XP needed for the next level.
 *
 * The first level up has to land fast: it is the moment a player learns the run
 * gets better, and at the original curve the bot took up to 59 seconds to reach
 * it, which is far too long to wait for the first reward.
 */
export function xpForLevel(level: number): number {
  return Math.round(3 + level * 2.4 + level * level * 0.5)
}
