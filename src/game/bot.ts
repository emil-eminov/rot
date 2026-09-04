import { HARMLESS_BELOW } from './rot'
import { ARENA, type World } from './world'

/**
 * A scripted player, good enough to be a fair test subject.
 *
 * Balance cannot be tuned against a dummy that stands still: it dies in
 * eighteen seconds and never reaches a level up, which says nothing about how
 * the game plays. The bot flees crowds, walks over gems and steps off rot,
 * which is what a competent human does, so "does a run last five minutes and
 * level up steadily" becomes a question CI can answer.
 *
 * It also drives the attract-mode demo, and it is how the pitch clip gets
 * recorded without anyone having to play well on camera.
 */

/** How far ahead the bot notices enemies. */
const AWARENESS = 260

/** Gems further than this are not worth crossing the arena for. */
const GEM_REACH = 420

export function botSteering(world: World): { x: number; y: number } {
  const player = world.player
  let fleeX = 0
  let fleeY = 0

  for (const enemy of world.enemies) {
    const dx = player.x - enemy.x
    const dy = player.y - enemy.y
    const distance = Math.hypot(dx, dy)
    if (distance > AWARENESS || distance < 0.001) continue
    // Inverse-square: a crowd at arm's length outweighs a wall of them further off.
    const weight = (1 - distance / AWARENESS) ** 2
    fleeX += (dx / distance) * weight
    fleeY += (dy / distance) * weight
  }

  let seekX = 0
  let seekY = 0
  let bestGem = GEM_REACH
  for (const gem of world.gems) {
    const dx = gem.x - player.x
    const dy = gem.y - player.y
    const distance = Math.hypot(dx, dy)
    if (distance < bestGem) {
      bestGem = distance
      seekX = dx / (distance || 1)
      seekY = dy / (distance || 1)
    }
  }

  // Step off poisoned ground: sample four directions and prefer the cleanest.
  let cleanX = 0
  let cleanY = 0
  if (world.rot.at(player.x, player.y) > HARMLESS_BELOW) {
    let best = Infinity
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, 0.7],
      [0.7, -0.7],
      [-0.7, -0.7],
    ] as const) {
      const value = world.rot.at(player.x + dx * 70, player.y + dy * 70)
      if (value < best) {
        best = value
        cleanX = dx
        cleanY = dy
      }
    }
  }

  // Stay off the walls: being cornered is how a careless run ends.
  const margin = 160
  const wallX = player.x > ARENA - margin ? -1 : player.x < -ARENA + margin ? 1 : 0
  const wallY = player.y > ARENA - margin ? -1 : player.y < -ARENA + margin ? 1 : 0

  const x = fleeX * 1.5 + seekX * 0.75 + cleanX * 1.2 + wallX * 2
  const y = fleeY * 1.5 + seekY * 0.75 + cleanY * 1.2 + wallY * 2
  const length = Math.hypot(x, y)
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
}
