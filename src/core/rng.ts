/**
 * Seeded random, so a run can be replayed exactly.
 *
 * Needed for tests: "does the spawn director escalate" is only answerable if
 * the same seed produces the same run twice.
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    // xorshift32: cheap, good enough for spawn positions and upgrade draws.
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

/** Draws `count` distinct items, or as many as exist. */
export function sample<T>(rng: () => number, items: readonly T[], count: number): T[] {
  const pool = [...items]
  const out: T[] = []
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!)
  }
  return out
}
