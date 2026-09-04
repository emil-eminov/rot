/**
 * Fixed-timestep loop with an accumulator.
 *
 * A survivors run is decided by hundreds of small collisions per second, so
 * simulation must not vary with frame rate: on a 120Hz phone the swarm would
 * otherwise close in at twice the speed it does on a 60Hz one.
 */
export const TICK_HZ = 60
export const TICK_SECONDS = 1 / TICK_HZ

/** Longest frame the accumulator honours, so a backgrounded tab cannot stall. */
export const MAX_FRAME_SECONDS = 0.25

export interface LoopState {
  readonly accumulator: number
  readonly tick: number
}

export const INITIAL_LOOP_STATE: LoopState = { accumulator: 0, tick: 0 }

export interface AdvanceResult {
  readonly state: LoopState
  readonly alpha: number
  readonly stepped: number
}

export function advance(
  state: LoopState,
  frameSeconds: number,
  step: (tick: number) => void,
): AdvanceResult {
  const clamped = Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS)
  let accumulator = state.accumulator + clamped
  let tick = state.tick
  let stepped = 0
  while (accumulator >= TICK_SECONDS) {
    step(tick)
    tick += 1
    stepped += 1
    accumulator -= TICK_SECONDS
  }
  return { state: { accumulator, tick }, alpha: accumulator / TICK_SECONDS, stepped }
}

export interface LoopHandle {
  stop(): void
}

/**
 * Errors are caught and the loop keeps running.
 *
 * This is not defensive decoration. Without it, one exception anywhere in a
 * step or a draw means requestAnimationFrame is never called again and the game
 * freezes completely, with no message and no recovery. That is exactly what
 * happened: a particle drawn one frame after its life ran out asked the canvas
 * for a negative radius, the canvas threw, and the whole game stopped.
 *
 * A frame that fails is skipped. Failures are reported once so a real bug is
 * still visible rather than silently swallowed.
 */
export function startLoop(step: (tick: number) => void, render: (alpha: number) => void): LoopHandle {
  let state = INITIAL_LOOP_STATE
  let last = performance.now()
  let reported = false
  let frame = requestAnimationFrame(onFrame)

  function onFrame(now: number): void {
    try {
      const result = advance(state, (now - last) / 1000, step)
      state = result.state
      render(result.alpha)
    } catch (error) {
      if (!reported) {
        reported = true
        console.error('Frame failed, continuing:', error)
      }
    }
    last = now
    frame = requestAnimationFrame(onFrame)
  }

  return { stop: () => cancelAnimationFrame(frame) }
}
