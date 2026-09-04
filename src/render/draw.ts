import { ARENA, KINDS, type World } from '../game/world'
import { CELL } from '../game/rot'

/**
 * Canvas2D, no WebGL and no dependencies.
 *
 * The previous project shipped a 3.25MB bundle because it carried a 3D engine
 * and a physics engine. This one is a few tens of kilobytes, which matters: a
 * playable ad has to start before the viewer scrolls past it.
 */

const PALETTE = {
  floor: '#12161a',
  grid: '#1b2128',
  wall: '#39c6a2',
  player: '#f2f7f5',
  bullet: '#ffe27a',
  gem: '#63e0ff',
  enemy: ['#e0556b', '#ff9d4d', '#b46bff'],
} as const

/** World units visible across the smaller screen axis. Sets how big things feel. */
const VIEW_SPAN = 760

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly rotCanvas: HTMLCanvasElement
  private readonly rotCtx: CanvasRenderingContext2D
  private readonly rotImage: ImageData
  private cameraX = 0
  private cameraY = 0
  width = 0
  height = 0
  scale = 1

  constructor(private readonly canvas: HTMLCanvasElement, gridSize: number) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('This device cannot provide a 2D canvas')
    this.ctx = ctx

    // The rot field is drawn at grid resolution and scaled up with smoothing,
    // which turns 1800 cells into soft pools for the cost of one drawImage.
    this.rotCanvas = document.createElement('canvas')
    this.rotCanvas.width = gridSize
    this.rotCanvas.height = gridSize
    const rotCtx = this.rotCanvas.getContext('2d')
    if (!rotCtx) throw new Error('This device cannot provide a 2D canvas')
    this.rotCtx = rotCtx
    this.rotImage = rotCtx.createImageData(gridSize, gridSize)
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.floor(this.width * dpr)
    this.canvas.height = Math.floor(this.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.scale = Math.max(this.width, this.height) / VIEW_SPAN
  }

  /** Screen position to world position, for the drag control. */
  toWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.width / 2) / this.scale + this.cameraX,
      y: (sy - this.height / 2) / this.scale + this.cameraY,
    }
  }

  draw(world: World, time: number): void {
    const ctx = this.ctx
    // Camera eases toward the player so a dodge does not jerk the whole screen.
    this.cameraX += (world.player.x - this.cameraX) * 0.14
    this.cameraY += (world.player.y - this.cameraY) * 0.14

    ctx.fillStyle = PALETTE.floor
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.save()
    const shake = world.shake
    const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0
    const shakeY = shake > 0 ? (Math.random() - 0.5) * shake : 0
    ctx.translate(this.width / 2 + shakeX, this.height / 2 + shakeY)
    ctx.scale(this.scale, this.scale)
    ctx.translate(-this.cameraX, -this.cameraY)

    this.drawGrid(ctx)
    this.drawRot(ctx, world)
    this.drawWalls(ctx)
    this.drawGems(ctx, world, time)
    this.drawEnemies(ctx, world)
    this.drawPlayer(ctx, world, time)
    this.drawBullets(ctx, world)
    this.drawParticles(ctx, world)

    ctx.restore()
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const step = 120
    ctx.strokeStyle = PALETTE.grid
    ctx.lineWidth = 1 / this.scale
    ctx.beginPath()
    for (let x = -ARENA; x <= ARENA; x += step) {
      ctx.moveTo(x, -ARENA)
      ctx.lineTo(x, ARENA)
    }
    for (let y = -ARENA; y <= ARENA; y += step) {
      ctx.moveTo(-ARENA, y)
      ctx.lineTo(ARENA, y)
    }
    ctx.stroke()
  }

  private drawRot(ctx: CanvasRenderingContext2D, world: World): void {
    const cells = world.rot.cells
    const data = this.rotImage.data
    for (let i = 0; i < cells.length; i++) {
      const value = cells[i]!
      const p = i * 4
      if (value <= 0) {
        data[p + 3] = 0
        continue
      }
      // Rot goes from a sickly green haze to near-black as it thickens, so the
      // dangerous ground is legible at a glance without a legend.
      const t = Math.min(1, value)
      data[p] = 30 + 60 * (1 - t)
      data[p + 1] = 90 + 70 * (1 - t)
      data[p + 2] = 50 + 40 * (1 - t)
      data[p + 3] = Math.floor(60 + 195 * t)
    }
    this.rotCtx.putImageData(this.rotImage, 0, 0)
    ctx.imageSmoothingEnabled = true
    const size = world.rot.width * CELL
    ctx.drawImage(this.rotCanvas, -size / 2, -size / 2, size, size)
  }

  private drawWalls(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = PALETTE.wall
    ctx.lineWidth = 5 / this.scale
    ctx.globalAlpha = 0.55
    ctx.strokeRect(-ARENA, -ARENA, ARENA * 2, ARENA * 2)
    ctx.globalAlpha = 1
  }

  private drawGems(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    ctx.fillStyle = PALETTE.gem
    for (const gem of world.gems) {
      if (!gem.alive) continue
      const pulse = 3.4 + Math.sin(time * 6 + gem.x) * 0.7
      ctx.beginPath()
      ctx.arc(gem.x, gem.y, pulse, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, world: World): void {
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : PALETTE.enemy[enemy.kind] ?? PALETTE.enemy[0]
      // Squash on flash: a hit that does not deform reads as no hit at all.
      const squash = enemy.flash > 0 ? 1.22 : 1
      ctx.beginPath()
      ctx.ellipse(enemy.x, enemy.y, enemy.radius * squash, enemy.radius / squash, 0, 0, Math.PI * 2)
      ctx.fill()
      if (enemy.kind === 2 && enemy.hp < enemy.maxHp) {
        ctx.fillStyle = '#00000088'
        ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2, 3)
        ctx.fillStyle = '#ff5a5a'
        ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 3)
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    const player = world.player
    // Blink while invulnerable, so a hit is visible for longer than it lasts.
    if (player.invulnerable > 0 && Math.floor(time * 20) % 2 === 0) return
    ctx.fillStyle = PALETTE.player
    ctx.beginPath()
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#39c6a2'
    ctx.lineWidth = 2.5 / this.scale
    ctx.beginPath()
    ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2)
    ctx.stroke()
  }

  private drawBullets(ctx: CanvasRenderingContext2D, world: World): void {
    ctx.strokeStyle = PALETTE.bullet
    ctx.lineCap = 'round'
    ctx.lineWidth = 4
    ctx.beginPath()
    for (const bullet of world.bullets) {
      if (!bullet.alive) continue
      // Drawn as a short streak along its own velocity: a dot at 640 units per
      // second is invisible, a streak reads as speed.
      ctx.moveTo(bullet.x, bullet.y)
      ctx.lineTo(bullet.x - bullet.vx * 0.018, bullet.y - bullet.vy * 0.018)
    }
    ctx.stroke()
  }

  private drawParticles(ctx: CanvasRenderingContext2D, world: World): void {
    for (const particle of world.particles) {
      if (!particle.alive) continue
      // Clamped here as well. Entities are drawn between a step and the next
      // compaction, so the renderer cannot assume the simulation has already
      // tidied up after itself.
      const life = Math.max(0, Math.min(1, particle.life / particle.maxLife))
      const radius = particle.radius * life
      if (radius <= 0) continue
      ctx.globalAlpha = life
      ctx.fillStyle = `hsl(${particle.hue}, 85%, ${45 + life * 30}%)`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

export { KINDS }
