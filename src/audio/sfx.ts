/**
 * Every sound is synthesised. No audio files, so nothing to license, nothing to
 * download, and the whole game still fits in a playable ad.
 *
 * Sound is doing more work here than the graphics are: a kill without a sound
 * reads as a bug, and the same kill with a 60ms noise burst reads as impact.
 */

let context: AudioContext | undefined
let master: GainNode | undefined
let muted = false

/** Browsers refuse to start audio until the user has touched the page. */
export function initAudio(): void {
  if (context) {
    void context.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  context = new Ctor()
  master = context.createGain()
  master.gain.value = 0.32
  master.connect(context.destination)
}

export function setMuted(value: boolean): void {
  muted = value
  if (master) master.gain.value = value ? 0 : 0.32
}

export function isMuted(): boolean {
  return muted
}

function tone(
  type: OscillatorType,
  from: number,
  to: number,
  duration: number,
  volume: number,
  delay = 0,
): void {
  if (!context || !master || muted) return
  const start = context.currentTime + delay
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(master)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

let noiseBuffer: AudioBuffer | undefined

function noise(duration: number, volume: number, filterFrom: number, filterTo: number): void {
  if (!context || !master || muted) return
  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.4, context.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const start = context.currentTime
  const source = context.createBufferSource()
  source.buffer = noiseBuffer
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFrom, start)
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterTo), start + duration)
  const gain = context.createGain()
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(gain).connect(master)
  source.start(start)
  source.stop(start + duration + 0.02)
}

/** Deliberately quiet and short: it fires several times a second all run. */
export function sfxShoot(): void {
  tone('square', 620, 300, 0.05, 0.05)
}

export function sfxHit(): void {
  noise(0.05, 0.14, 2600, 900)
}

export function sfxKill(big: boolean): void {
  noise(big ? 0.3 : 0.13, big ? 0.5 : 0.24, big ? 1500 : 2400, 120)
  if (big) tone('sawtooth', 180, 40, 0.32, 0.22)
}

export function sfxGem(): void {
  tone('triangle', 880, 1320, 0.07, 0.09)
}

export function sfxHurt(): void {
  tone('sawtooth', 240, 70, 0.24, 0.3)
  noise(0.16, 0.2, 900, 200)
}

export function sfxLevel(): void {
  tone('triangle', 523, 523, 0.1, 0.16)
  tone('triangle', 659, 659, 0.1, 0.16, 0.08)
  tone('triangle', 784, 784, 0.16, 0.18, 0.16)
}

export function sfxDeath(): void {
  tone('sawtooth', 340, 40, 1.1, 0.34)
  noise(0.9, 0.3, 1600, 90)
}
