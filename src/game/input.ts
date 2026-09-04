/**
 * One thumb, anywhere on the screen.
 *
 * A fixed on-screen stick wastes a corner and forces the thumb to a spot it did
 * not choose. Touching anywhere sets the origin, and dragging from there steers,
 * which is what the genre's better mobile ports settled on.
 */

/** Drag distance, in CSS pixels, that counts as full speed. */
const FULL_TILT = 62

export interface Steering {
  readonly x: number
  readonly y: number
  readonly active: boolean
}

export class DragControl {
  private originX = 0
  private originY = 0
  private currentX = 0
  private currentY = 0
  private pointer: number | undefined

  constructor(target: HTMLElement) {
    target.addEventListener('pointerdown', (event) => {
      if (this.pointer !== undefined) return
      this.pointer = event.pointerId
      target.setPointerCapture(event.pointerId)
      this.originX = this.currentX = event.clientX
      this.originY = this.currentY = event.clientY
    })
    target.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.pointer) return
      this.currentX = event.clientX
      this.currentY = event.clientY
      // Re-anchor when the thumb runs far from its origin, so a long drag does
      // not leave the stick pinned at full tilt in a stale direction.
      const dx = this.currentX - this.originX
      const dy = this.currentY - this.originY
      const distance = Math.hypot(dx, dy)
      if (distance > FULL_TILT * 1.8) {
        const scale = (FULL_TILT * 1.8) / distance
        this.originX = this.currentX - dx * scale
        this.originY = this.currentY - dy * scale
      }
    })
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== this.pointer) return
      this.pointer = undefined
    }
    target.addEventListener('pointerup', release)
    target.addEventListener('pointercancel', release)
  }

  get steering(): Steering {
    if (this.pointer === undefined) return { x: 0, y: 0, active: false }
    const dx = this.currentX - this.originX
    const dy = this.currentY - this.originY
    const distance = Math.hypot(dx, dy)
    if (distance < 3) return { x: 0, y: 0, active: true }
    const tilt = Math.min(1, distance / FULL_TILT)
    return { x: (dx / distance) * tilt, y: (dy / distance) * tilt, active: true }
  }
}
