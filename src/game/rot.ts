/**
 * The hook: every kill poisons the ground where it died.
 *
 * In every other survivors game, killing is unambiguously good. Here it is a
 * cost. Playing well destroys your own safe space, so the arena closes in on
 * you as a direct consequence of your own success, and standing still becomes
 * impossible sooner the better you are doing.
 */

/** World units per rot cell. Coarse on purpose: the stains should read as pools. */
export const CELL = 44

/** Rot added at the exact cell where something dies. */
const KILL_ROT = 0.62

/** Rot added to the four neighbours, so pools spread and merge. */
const SPLASH_ROT = 0.22

/**
 * Rot lost per second.
 *
 * Measured, not guessed. At 0.055 the ground never accumulated at all: a
 * bot run of 168 kills finished with 0% coverage, so the game's whole premise
 * was invisible. A full stain now takes about eighty seconds to clear, which is
 * long enough that the area you are fighting in turns against you.
 */
const DECAY_PER_SECOND = 0.012

/** Below this, rot is visible but harmless: near-misses should not feel unfair. */
export const HARMLESS_BELOW = 0.18

/** Damage per second at full rot. */
const MAX_DAMAGE_PER_SECOND = 26

/** Fraction of move speed lost at full rot. Makes the floor feel physical. */
const MAX_SLOW = 0.42

export class RotField {
  readonly cells: Float32Array
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = new Float32Array(width * height)
  }

  private index(cx: number, cy: number): number {
    return cy * this.width + cx
  }

  inside(cx: number, cy: number): boolean {
    return cx >= 0 && cy >= 0 && cx < this.width && cy < this.height
  }

  /** Grid coordinate for a world position, with the grid centred on the origin. */
  cellX(x: number): number {
    return Math.floor(x / CELL + this.width / 2)
  }

  cellY(y: number): number {
    return Math.floor(y / CELL + this.height / 2)
  }

  at(x: number, y: number): number {
    const cx = this.cellX(x)
    const cy = this.cellY(y)
    return this.inside(cx, cy) ? this.cells[this.index(cx, cy)]! : 0
  }

  private add(cx: number, cy: number, amount: number): void {
    if (!this.inside(cx, cy)) return
    const i = this.index(cx, cy)
    this.cells[i] = Math.min(1, this.cells[i]! + amount)
  }

  /** Called wherever something dies. */
  stain(x: number, y: number, scale = 1): void {
    const cx = this.cellX(x)
    const cy = this.cellY(y)
    this.add(cx, cy, KILL_ROT * scale)
    this.add(cx + 1, cy, SPLASH_ROT * scale)
    this.add(cx - 1, cy, SPLASH_ROT * scale)
    this.add(cx, cy + 1, SPLASH_ROT * scale)
    this.add(cx, cy - 1, SPLASH_ROT * scale)
  }

  /** `decayMultiplier` is raised by upgrades that clean the ground faster. */
  update(dt: number, decayMultiplier = 1): void {
    const drop = DECAY_PER_SECOND * decayMultiplier * dt
    for (let i = 0; i < this.cells.length; i++) {
      const value = this.cells[i]!
      if (value > 0) this.cells[i] = value > drop ? value - drop : 0
    }
  }

  /** Total rot on the field, for the end-of-run summary. */
  get coverage(): number {
    let sum = 0
    for (let i = 0; i < this.cells.length; i++) sum += this.cells[i]!
    return sum / this.cells.length
  }
}

/** Damage per second taken while standing on this much rot. */
export function rotDamagePerSecond(rot: number, resistance = 0): number {
  if (rot <= HARMLESS_BELOW) return 0
  const over = (rot - HARMLESS_BELOW) / (1 - HARMLESS_BELOW)
  return over * MAX_DAMAGE_PER_SECOND * Math.max(0, 1 - resistance)
}

/** Movement multiplier while standing on this much rot. */
export function rotSpeedMultiplier(rot: number): number {
  return 1 - Math.min(rot, 1) * MAX_SLOW
}
