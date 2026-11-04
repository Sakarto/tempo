export interface KeyInfo { key: string; tag: string; editable: boolean; repeat: boolean; ctrl: boolean; alt: boolean; meta: boolean }
export interface KeyContext { hasHead: boolean; started: boolean; canStart: boolean; checkIn: boolean }
export type Shortcut = 'toggle' | 'done' | 'extend'

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const ACTIVATES_ON_SPACE = new Set(['BUTTON', 'A', 'SUMMARY'])

/** Which shortcut (if any) a key press means: Space start/pause, D done, E +15 min. */
export function shortcutFor(k: KeyInfo, ctx: KeyContext): Shortcut | null {
  if (k.repeat || k.ctrl || k.alt || k.meta || k.editable || TYPING.has(k.tag) || !ctx.hasHead) return null
  switch (k.key) {
    case ' ':
      // On a focused button/link, Space already clicks it; handling it here would fire twice.
      return ACTIVATES_ON_SPACE.has(k.tag) || ctx.checkIn || !(ctx.started || ctx.canStart) ? null : 'toggle'
    case 'd': case 'D':
      return ctx.started ? 'done' : null
    case 'e': case 'E':
      return ctx.started ? 'extend' : null
    default:
      return null
  }
}
