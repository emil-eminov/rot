import { startLoop, TICK_SECONDS } from './core/loop'
import { World } from './game/world'
import { DragControl } from './game/input'
import { botSteering } from './game/bot'
import { Renderer } from './render/draw'
import { createHud } from './ui/hud'
import {
  initAudio,
  isMuted,
  setMuted,
  sfxDeath,
  sfxGem,
  sfxHit,
  sfxHurt,
  sfxKill,
  sfxLevel,
  sfxShoot,
} from './audio/sfx'
import type { Upgrade } from './game/upgrades'

const BEST_KEY = 'rot.best'

declare global {
  interface Window {
    __rot?: {
      stats(): { fps: number; entities: number; rot: number; seconds: number }
      phase(): string
      /**
       * Runs the simulation forward without waiting in real time, played by
       * the scripted bot. Used by the browser tests and by the attract mode.
       */
      simulate(seconds: number, still?: boolean): void
      choose(index: number): void
      restart(): void
    }
  }
}

const canvas = document.getElementById('stage') as HTMLCanvasElement
const control = new DragControl(canvas)
let world = new World(Date.now() >>> 0)
const renderer = new Renderer(canvas, world.rot.width)
renderer.resize()
window.addEventListener('resize', () => renderer.resize())

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0)
  } catch {
    // Private windows and blocked site data throw here. A missing best score is
    // not worth breaking a run over.
    return 0
  }
}

function writeBest(seconds: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(seconds))
  } catch {
    /* ignore */
  }
}

let best = readBest()

const hud = createHud(document.body, {
  onChoose: (upgrade: Upgrade) => {
    world.choose(upgrade)
    hud.hideChoices()
  },
  onRestart: () => restart(),
  onToggleSound: () => {
    setMuted(!isMuted())
    hud.setSound(!isMuted())
  },
})
hud.setSound(true)

function restart(): void {
  world = new World(Date.now() >>> 0)
  hud.hideDeath()
  hud.hideChoices()
}

// Audio cannot start until the user touches the page.
const wake = (): void => initAudio()
canvas.addEventListener('pointerdown', wake, { once: true })
document.addEventListener('pointerdown', wake, { once: true })

function drainEvents(): void {
  for (const event of world.events) {
    switch (event.type) {
      case 'shoot':
        sfxShoot()
        break
      case 'hit':
        sfxHit()
        break
      case 'kill':
        sfxKill(event.big)
        break
      case 'gem':
        sfxGem()
        break
      case 'hurt':
        sfxHurt()
        break
      case 'level':
        sfxLevel()
        break
      case 'death':
        sfxDeath()
        break
    }
  }
  world.events.length = 0
}

let wasChoosing = false
let wasDead = false
let frames = 0
let fpsWindowStart = performance.now()
let fps = 0

startLoop(
  () => {
    const steering = control.steering
    world.step(TICK_SECONDS, steering)
    drainEvents()

    const choosing = world.phase === 'CHOOSING'
    if (choosing && !wasChoosing) hud.showChoices(world.choices)
    wasChoosing = choosing

    const dead = world.phase === 'DEAD'
    if (dead && !wasDead) {
      if (world.elapsed > best) {
        best = world.elapsed
        writeBest(best)
      }
      hud.showDeath(world.elapsed, world.kills, world.player.level, best)
    }
    wasDead = dead
  },
  () => {
    renderer.draw(world, performance.now() / 1000)
    hud.setVitals(world.player.hp / world.player.maxHp, world.player.xp / world.player.xpToLevel, world.player.level)
    hud.setRun(world.elapsed, world.kills)

    frames += 1
    const now = performance.now()
    if (now - fpsWindowStart >= 500) {
      // Measured over a window rather than a running average, so a stall shows
      // up immediately instead of being diluted by every frame that came before.
      fps = Math.round((frames * 1000) / (now - fpsWindowStart))
      frames = 0
      fpsWindowStart = now
      const entities = world.enemies.length + world.bullets.length + world.gems.length + world.particles.length
      hud.setStats(`${fps} fps\n${entities} entities\n${(world.rot.coverage * 100).toFixed(0)}% rot`)
    }
  },
)

window.__rot = {
  stats: () => ({
    fps,
    entities: world.enemies.length + world.bullets.length + world.gems.length + world.particles.length,
    rot: world.rot.coverage,
    seconds: world.elapsed,
  }),
  phase: () => world.phase,
  simulate: (seconds: number, still = false) => {
    const ticks = Math.floor(seconds / TICK_SECONDS)
    for (let i = 0; i < ticks; i++) {
      world.step(TICK_SECONDS, still ? { x: 0, y: 0 } : botSteering(world))
      if (world.phase === 'CHOOSING') world.choose(world.choices[0]!)
      if (world.phase === 'DEAD') break
    }
    world.events.length = 0
  },
  choose: (index: number) => {
    const upgrade = world.choices[index]
    if (upgrade) {
      world.choose(upgrade)
      hud.hideChoices()
    }
  },
  restart: () => restart(),
}
