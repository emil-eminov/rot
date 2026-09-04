import { createRng, sample } from '../core/rng'
import { RotField, rotDamagePerSecond, rotSpeedMultiplier } from './rot'
import { availableUpgrades, xpForLevel, type Upgrade } from './upgrades'
import { baseStats, type Bullet, type Enemy, type Gem, type Particle, type Player, type Stats } from './types'

/** Half-width of the arena in world units. Walls are hard: there is no outside. */
export const ARENA = 900

/** Rot grid covers the arena with a little margin. */
const GRID = Math.ceil((ARENA * 2) / 44) + 2

export type Phase = 'PLAYING' | 'CHOOSING' | 'DEAD'

export type GameEvent =
  | { type: 'shoot'; x: number; y: number }
  | { type: 'hit'; x: number; y: number }
  | { type: 'kill'; x: number; y: number; big: boolean }
  | { type: 'hurt' }
  | { type: 'gem' }
  | { type: 'level' }
  | { type: 'death' }

interface EnemyKind {
  readonly hp: number
  readonly speed: number
  readonly radius: number
  readonly damage: number
  readonly rotScale: number
  readonly xp: number
}

/**
 * Three kinds is enough for the first playable. Their job is to make the swarm
 * read as varied at a glance: a wall of grunts, darters that force you to move,
 * and hulks that punish standing still.
 */
export const KINDS: readonly EnemyKind[] = [
  { hp: 20, speed: 62, radius: 13, damage: 9, rotScale: 1, xp: 1 },
  { hp: 13, speed: 122, radius: 10, damage: 7, rotScale: 0.7, xp: 1 },
  { hp: 95, speed: 40, radius: 22, damage: 20, rotScale: 2.1, xp: 4 },
]

/** Seconds of frozen simulation after a kill. The single best-value feel trick. */
const HITSTOP_KILL = 0.035
const HITSTOP_BIG = 0.09

const MAX_ENEMIES = 260
const MAX_BULLETS = 260
const MAX_GEMS = 400
const MAX_PARTICLES = 500

export class World {
  readonly rot = new RotField(GRID, GRID)
  readonly player: Player
  readonly enemies: Enemy[] = []
  readonly bullets: Bullet[] = []
  readonly gems: Gem[] = []
  readonly particles: Particle[] = []
  readonly events: GameEvent[] = []
  stats: Stats = baseStats()
  taken: Record<string, number> = {}
  phase: Phase = 'PLAYING'
  choices: Upgrade[] = []
  elapsed = 0
  kills = 0
  /** Frozen simulation time remaining, for impact. Rendering continues. */
  hitstop = 0
  shake = 0
  private fireCooldown = 0
  private spawnCredit = 0
  private readonly rng: () => number

  constructor(seed = 1) {
    this.rng = createRng(seed)
    this.player = {
      x: 0,
      y: 0,
      hp: 120,
      maxHp: 120,
      radius: 13,
      invulnerable: 0,
      level: 1,
      xp: 0,
      xpToLevel: xpForLevel(1),
    }
  }

  /** Enemies per second at the current point in the run. */
  private spawnRate(): number {
    const minutes = this.elapsed / 60
    return 1.9 + minutes * 2.9 + minutes * minutes * 0.95
  }

  private spawn(): void {
    if (this.enemies.length >= MAX_ENEMIES) return
    const minutes = this.elapsed / 60
    // Darters appear after 30s, hulks after 90s: the swarm should change shape,
    // not just get denser.
    const roll = this.rng()
    let kind = 0
    if (minutes > 1.5 && roll > 0.86) kind = 2
    else if (minutes > 0.5 && roll > 0.55) kind = 1
    const spec = KINDS[kind]!

    // Spawn on a ring outside the visible area but inside the arena.
    const angle = this.rng() * Math.PI * 2
    const distance = 620 + this.rng() * 160
    const x = Math.max(-ARENA, Math.min(ARENA, this.player.x + Math.cos(angle) * distance))
    const y = Math.max(-ARENA, Math.min(ARENA, this.player.y + Math.sin(angle) * distance))

    // Later enemies are tougher, so early upgrades do not trivialise minute six.
    const toughness = 1 + minutes * 0.45
    this.enemies.push({
      x,
      y,
      vx: 0,
      vy: 0,
      hp: spec.hp * toughness,
      maxHp: spec.hp * toughness,
      radius: spec.radius,
      speed: spec.speed,
      damage: spec.damage,
      flash: 0,
      rotScale: spec.rotScale,
      kind,
      alive: true,
    })
  }

  private nearestEnemy(): Enemy | undefined {
    let best: Enemy | undefined
    let bestDistance = Infinity
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      const d = (enemy.x - this.player.x) ** 2 + (enemy.y - this.player.y) ** 2
      if (d < bestDistance) {
        bestDistance = d
        best = enemy
      }
    }
    return best
  }

  private fire(): void {
    const target = this.nearestEnemy()
    if (!target) return
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x)
    const count = this.stats.bulletCount
    // Fan the extra shots so more bullets means more coverage, not a thicker line.
    const spread = count > 1 ? 0.24 : 0
    for (let i = 0; i < count; i++) {
      if (this.bullets.length >= MAX_BULLETS) break
      const offset = count > 1 ? (i / (count - 1) - 0.5) * spread * count : 0
      const a = angle + offset
      this.bullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * this.stats.bulletSpeed,
        vy: Math.sin(a) * this.stats.bulletSpeed,
        damage: this.stats.damage,
        radius: 5,
        pierce: this.stats.pierce,
        life: 1.5,
        alive: true,
      })
    }
    this.events.push({ type: 'shoot', x: this.player.x, y: this.player.y })
  }

  private burst(x: number, y: number, count: number, hue: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return
      const a = this.rng() * Math.PI * 2
      const s = speed * (0.35 + this.rng() * 0.9)
      const life = 0.25 + this.rng() * 0.4
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        radius: 2 + this.rng() * 3,
        hue,
        alive: true,
      })
    }
  }

  private killEnemy(enemy: Enemy): void {
    enemy.alive = false
    this.kills += 1
    // The hook: the corpse poisons the ground it died on.
    this.rot.stain(enemy.x, enemy.y, enemy.rotScale)
    const big = enemy.kind === 2
    this.burst(enemy.x, enemy.y, big ? 16 : 8, big ? 96 : 130, big ? 210 : 160)
    this.hitstop = Math.max(this.hitstop, big ? HITSTOP_BIG : HITSTOP_KILL)
    this.shake = Math.min(14, this.shake + (big ? 7 : 2))
    if (this.gems.length < MAX_GEMS) {
      this.gems.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, value: KINDS[enemy.kind]!.xp, alive: true })
    }
    this.events.push({ type: 'kill', x: enemy.x, y: enemy.y, big })
  }

  private levelUp(): void {
    this.player.level += 1
    this.player.xp -= this.player.xpToLevel
    this.player.xpToLevel = xpForLevel(this.player.level)
    const pool = availableUpgrades(this.stats, this.taken)
    this.choices = sample(this.rng, pool, 3)
    // With nothing left to offer, skip the card entirely rather than show an
    // empty menu: a dead-end screen is worse than no screen.
    this.phase = this.choices.length > 0 ? 'CHOOSING' : 'PLAYING'
    this.events.push({ type: 'level' })
  }

  choose(upgrade: Upgrade): void {
    if (this.phase !== 'CHOOSING') return
    upgrade.apply(this.stats)
    this.taken[upgrade.id] = (this.taken[upgrade.id] ?? 0) + 1
    this.choices = []
    this.phase = this.player.xp >= this.player.xpToLevel ? 'PLAYING' : 'PLAYING'
    // A second level may already be owed if a big pickup crossed two thresholds.
    if (this.player.xp >= this.player.xpToLevel) this.levelUp()
  }

  /** One simulation tick. `move` is a unit-ish vector from the player's thumb. */
  step(dt: number, move: { x: number; y: number }): void {
    if (this.phase !== 'PLAYING') return

    if (this.hitstop > 0) {
      // Frozen: the frame still renders, so a kill reads as a punch rather than
      // a stutter. Particles keep moving so the screen never looks stalled.
      this.hitstop -= dt
      this.stepParticles(dt)
      return
    }

    this.elapsed += dt
    this.shake = Math.max(0, this.shake - dt * 42)

    const rotHere = this.rot.at(this.player.x, this.player.y)
    const speed = this.stats.moveSpeed * rotSpeedMultiplier(rotHere)
    const length = Math.hypot(move.x, move.y)
    if (length > 0.01) {
      const nx = move.x / Math.max(length, 1)
      const ny = move.y / Math.max(length, 1)
      this.player.x += nx * speed * dt
      this.player.y += ny * speed * dt
      const limit = ARENA - this.player.radius
      this.player.x = Math.max(-limit, Math.min(limit, this.player.x))
      this.player.y = Math.max(-limit, Math.min(limit, this.player.y))
    }

    const rotDamage = rotDamagePerSecond(rotHere, this.stats.rotResistance)
    if (rotDamage > 0) this.player.hp -= rotDamage * dt
    if (this.stats.regen > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.stats.regen * dt)
    }
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt)

    this.rot.update(dt, this.stats.rotDecay)

    this.spawnCredit += this.spawnRate() * dt
    while (this.spawnCredit >= 1) {
      this.spawnCredit -= 1
      this.spawn()
    }

    this.fireCooldown -= dt
    if (this.fireCooldown <= 0) {
      this.fire()
      this.fireCooldown = this.stats.fireInterval
    }

    this.stepEnemies(dt)
    this.stepBullets(dt)
    this.stepGems(dt)
    this.stepParticles(dt)
    this.compact()

    if (this.player.hp <= 0) {
      this.player.hp = 0
      this.phase = 'DEAD'
      this.shake = 18
      this.burst(this.player.x, this.player.y, 30, 20, 240)
      this.events.push({ type: 'death' })
    }
  }

  private stepEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      enemy.flash = Math.max(0, enemy.flash - dt)
      const dx = this.player.x - enemy.x
      const dy = this.player.y - enemy.y
      const distance = Math.hypot(dx, dy) || 1
      enemy.x += (dx / distance) * enemy.speed * dt
      enemy.y += (dy / distance) * enemy.speed * dt

      if (distance < enemy.radius + this.player.radius && this.player.invulnerable <= 0) {
        this.player.hp -= enemy.damage
        this.player.invulnerable = 0.55
        this.shake = Math.min(20, this.shake + 9)
        this.events.push({ type: 'hurt' })
      }
    }
    this.separate()
  }

  /**
   * Pushes overlapping enemies apart. Without it the swarm collapses into a
   * single stacked point and stops reading as a crowd, which is most of the
   * appeal of the genre.
   */
  private separate(): void {
    const list = this.enemies
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!
      if (!a.alive) continue
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!
        if (!b.alive) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const minimum = a.radius + b.radius
        const squared = dx * dx + dy * dy
        if (squared >= minimum * minimum || squared === 0) continue
        const distance = Math.sqrt(squared)
        const push = (minimum - distance) * 0.5
        const nx = dx / distance
        const ny = dy / distance
        a.x -= nx * push
        a.y -= ny * push
        b.x += nx * push
        b.y += ny * push
      }
    }
  }

  private stepBullets(dt: number): void {
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue
      bullet.x += bullet.vx * dt
      bullet.y += bullet.vy * dt
      bullet.life -= dt
      if (bullet.life <= 0 || Math.abs(bullet.x) > ARENA || Math.abs(bullet.y) > ARENA) {
        bullet.alive = false
        continue
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue
        const dx = enemy.x - bullet.x
        const dy = enemy.y - bullet.y
        const reach = enemy.radius + bullet.radius
        if (dx * dx + dy * dy > reach * reach) continue
        enemy.hp -= bullet.damage
        enemy.flash = 0.09
        this.events.push({ type: 'hit', x: bullet.x, y: bullet.y })
        this.burst(bullet.x, bullet.y, 3, 45, 90)
        if (enemy.hp <= 0) this.killEnemy(enemy)
        if (bullet.pierce > 0) {
          bullet.pierce -= 1
        } else {
          bullet.alive = false
          break
        }
      }
    }
  }

  private stepGems(dt: number): void {
    for (const gem of this.gems) {
      if (!gem.alive) continue
      const dx = this.player.x - gem.x
      const dy = this.player.y - gem.y
      const distance = Math.hypot(dx, dy) || 1
      if (distance < this.stats.magnet) {
        // Accelerating pull: the snap at the end is most of the satisfaction.
        const pull = 420 * (1 - distance / this.stats.magnet) + 140
        gem.vx += (dx / distance) * pull * dt
        gem.vy += (dy / distance) * pull * dt
      }
      gem.vx *= 0.92
      gem.vy *= 0.92
      gem.x += gem.vx * dt
      gem.y += gem.vy * dt
      if (distance < this.player.radius + 10) {
        gem.alive = false
        this.player.xp += gem.value
        this.events.push({ type: 'gem' })
        if (this.player.xp >= this.player.xpToLevel) this.levelUp()
      }
    }
  }

  private stepParticles(dt: number): void {
    for (const particle of this.particles) {
      if (!particle.alive) continue
      particle.life -= dt
      if (particle.life <= 0) {
        particle.alive = false
        continue
      }
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.vx *= 0.9
      particle.vy *= 0.9
    }
  }

  /** Drops dead entities. Done once per tick rather than mid-iteration. */
  private compact(): void {
    prune(this.enemies)
    prune(this.bullets)
    prune(this.gems)
    prune(this.particles)
  }
}

function prune<T extends { alive: boolean }>(list: T[]): void {
  let write = 0
  for (let read = 0; read < list.length; read++) {
    const item = list[read]!
    if (item.alive) list[write++] = item
  }
  list.length = write
}
