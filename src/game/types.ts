export interface Vec2 {
  x: number
  y: number
}

export interface Player {
  x: number
  y: number
  hp: number
  maxHp: number
  radius: number
  /** Seconds of invulnerability left after a hit. */
  invulnerable: number
  level: number
  xp: number
  xpToLevel: number
}

export interface Enemy {
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  radius: number
  speed: number
  damage: number
  /** Seconds of white flash left after being hit. */
  flash: number
  /** Extra rot left on death. Bigger things stain more. */
  rotScale: number
  kind: number
  alive: boolean
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  /** How many more enemies this can pass through. */
  pierce: number
  life: number
  alive: boolean
}

export interface Gem {
  x: number
  y: number
  vx: number
  vy: number
  value: number
  alive: boolean
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  radius: number
  hue: number
  alive: boolean
}

export interface Stats {
  damage: number
  fireInterval: number
  bulletSpeed: number
  bulletCount: number
  pierce: number
  moveSpeed: number
  magnet: number
  rotResistance: number
  rotDecay: number
  regen: number
}

export function baseStats(): Stats {
  return {
    damage: 10,
    // Seconds between shots. The single most-felt number in the game.
    fireInterval: 0.42,
    bulletSpeed: 640,
    bulletCount: 1,
    pierce: 0,
    moveSpeed: 205,
    magnet: 95,
    rotResistance: 0,
    rotDecay: 1,
    regen: 0,
  }
}
