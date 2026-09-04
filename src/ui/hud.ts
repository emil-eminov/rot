import type { Upgrade } from '../game/upgrades'

/**
 * DOM overlay rather than canvas UI: the browser already does hit targets,
 * text rendering and safe-area insets better than canvas code would.
 */

export interface HudCallbacks {
  readonly onChoose: (upgrade: Upgrade) => void
  readonly onRestart: () => void
  readonly onToggleSound: () => void
}

export interface Hud {
  setVitals(hpFraction: number, xpFraction: number, level: number): void
  setRun(seconds: number, kills: number): void
  showChoices(choices: readonly Upgrade[]): void
  hideChoices(): void
  showDeath(seconds: number, kills: number, level: number, best: number): void
  hideDeath(): void
  setSound(on: boolean): void
  setStats(text: string): void
}

const STYLE = `
.hud { position: fixed; inset: 0; pointer-events: none; color: #eaf2ef;
  font: 700 16px/1.25 system-ui, -apple-system, sans-serif; user-select: none; -webkit-user-select: none; }
.hud .bars { position: absolute; top: calc(env(safe-area-inset-top, 8px) + 10px); left: 16px; right: 16px; }
.hud .bar { height: 9px; border-radius: 6px; background: #ffffff1f; overflow: hidden; margin-bottom: 6px; }
.hud .bar > i { display: block; height: 100%; width: 0%; border-radius: 6px; transition: width 90ms linear; }
.hud .hp > i { background: linear-gradient(90deg, #ff5a5a, #ff9d4d); }
.hud .xp > i { background: linear-gradient(90deg, #39c6a2, #63e0ff); }
.hud .meta { display: flex; justify-content: space-between; align-items: center;
  font: 600 13px/1 ui-monospace, monospace; opacity: 0.75; letter-spacing: 0.04em; }
.hud .diag { position: absolute; right: 16px; top: calc(env(safe-area-inset-top, 8px) + 62px);
  font: 500 11px/1.4 ui-monospace, monospace; opacity: 0.4; text-align: right; white-space: pre; }
.hud button { pointer-events: auto; font: inherit; border: 0; touch-action: manipulation; }
.hud .sound { position: absolute; right: 12px; bottom: calc(env(safe-area-inset-bottom, 8px) + 12px);
  width: 44px; height: 44px; border-radius: 12px; background: #ffffff14; color: #eaf2ef; }
.hud .overlay { position: absolute; inset: 0; display: none; place-content: center; justify-items: center;
  gap: 14px; padding: 24px; background: #06090899; backdrop-filter: blur(3px); pointer-events: auto; }
.hud .overlay.show { display: grid; }
.hud .title { font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.65; }
.hud .cards { display: grid; gap: 12px; width: min(420px, 88vw); }
.hud .card { display: grid; gap: 4px; text-align: left; padding: 16px 18px; border-radius: 16px;
  background: #17211f; box-shadow: inset 0 0 0 1px #39c6a244; color: #eaf2ef; }
.hud .card:active { background: #1f2d2a; }
.hud .card b { font-size: 19px; color: #63e0ff; }
.hud .card span { font-weight: 500; opacity: 0.78; font-size: 14px; }
.hud .big { font-size: 34px; letter-spacing: 0.02em; }
.hud .score { display: flex; gap: 22px; font: 600 15px/1 ui-monospace, monospace; opacity: 0.85; }
.hud .again { padding: 16px 30px; border-radius: 14px; background: #39c6a2; color: #08110f; font-size: 18px; }
`

export function createHud(parent: HTMLElement, callbacks: HudCallbacks): Hud {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.append(style)

  const root = document.createElement('div')
  root.className = 'hud'
  root.innerHTML = `
    <div class="bars">
      <div class="bar hp"><i data-hp></i></div>
      <div class="bar xp"><i data-xp></i></div>
      <div class="meta"><span data-level>LV 1</span><span data-run>0:00</span></div>
    </div>
    <div class="diag" data-diag></div>
    <button class="sound" data-sound aria-label="Toggle sound">&#9834;</button>
    <div class="overlay" data-choices>
      <div class="title">Level up</div>
      <div class="cards" data-cards></div>
    </div>
    <div class="overlay" data-death>
      <div class="big">You rotted</div>
      <div class="score"><span data-d-time></span><span data-d-kills></span><span data-d-level></span></div>
      <div class="title" data-d-best></div>
      <button class="again" data-again>Again</button>
    </div>`
  parent.append(root)

  const pick = <T extends HTMLElement>(name: string): T => root.querySelector<T>(`[data-${name}]`)!
  const hp = pick('hp')
  const xp = pick('xp')
  const cards = pick('cards')
  const choices = pick('choices')
  const death = pick('death')
  const sound = pick<HTMLButtonElement>('sound')

  sound.onclick = () => callbacks.onToggleSound()
  pick<HTMLButtonElement>('again').onclick = () => callbacks.onRestart()

  const clock = (seconds: number): string =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

  return {
    setVitals(hpFraction, xpFraction, level) {
      hp.style.width = `${Math.max(0, Math.min(1, hpFraction)) * 100}%`
      xp.style.width = `${Math.max(0, Math.min(1, xpFraction)) * 100}%`
      pick('level').textContent = `LV ${level}`
    },
    setRun(seconds, kills) {
      pick('run').textContent = `${clock(seconds)}  ${kills} kills`
    },
    showChoices(list) {
      cards.replaceChildren()
      for (const upgrade of list) {
        const button = document.createElement('button')
        button.className = 'card'
        button.innerHTML = `<b></b><span></span>`
        button.querySelector('b')!.textContent = upgrade.name
        button.querySelector('span')!.textContent = upgrade.detail
        button.onclick = () => callbacks.onChoose(upgrade)
        cards.append(button)
      }
      choices.classList.add('show')
    },
    hideChoices() {
      choices.classList.remove('show')
    },
    showDeath(seconds, kills, level, best) {
      pick('d-time').textContent = clock(seconds)
      pick('d-kills').textContent = `${kills} kills`
      pick('d-level').textContent = `LV ${level}`
      pick('d-best').textContent = seconds >= best ? 'New best' : `Best ${clock(best)}`
      death.classList.add('show')
    },
    hideDeath() {
      death.classList.remove('show')
    },
    setSound(on) {
      sound.style.opacity = on ? '1' : '0.35'
    },
    setStats(text) {
      pick('diag').textContent = text
    },
  }
}
