import { describe, expect, test } from 'vitest'
import { shortcutFor, type KeyContext, type KeyInfo } from './keys'

const key = (k: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({ key: k, code: '', tag: 'BODY', editable: false, repeat: false, ctrl: false, alt: false, meta: false, ...extra })
const running: KeyContext = { hasHead: true, started: true, canStart: true, checkIn: false }
const idle: KeyContext = { hasHead: true, started: false, canStart: true, checkIn: false }

describe('shortcutFor', () => {
  test('Space starts or pauses, D completes, E extends', () => {
    expect(shortcutFor(key(' '), idle)).toBe('toggle')
    expect(shortcutFor(key(' '), running)).toBe('toggle')
    expect(shortcutFor(key('d'), running)).toBe('done')
    expect(shortcutFor(key('D'), running)).toBe('done')
    expect(shortcutFor(key('e'), running)).toBe('extend')
    expect(shortcutFor(key('E'), running)).toBe('extend')
  })

  test('nothing fires while typing in a field', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(shortcutFor(key('d', { tag }), running)).toBeNull()
    expect(shortcutFor(key('e', { editable: true }), running)).toBeNull()
    expect(shortcutFor(key(' ', { tag: 'INPUT' }), idle)).toBeNull()
  })

  test('Space on a focused button or link is left to the browser (it clicks it)', () => {
    expect(shortcutFor(key(' ', { tag: 'BUTTON' }), idle)).toBeNull()
    expect(shortcutFor(key(' ', { tag: 'A' }), idle)).toBeNull()
    expect(shortcutFor(key('d', { tag: 'BUTTON' }), running)).toBe('done')
  })

  test('browser/OS combos and key repeat never trigger', () => {
    expect(shortcutFor(key('d', { ctrl: true }), running)).toBeNull()
    expect(shortcutFor(key('e', { meta: true }), running)).toBeNull()
    expect(shortcutFor(key('d', { alt: true }), running)).toBeNull()
    expect(shortcutFor(key(' ', { repeat: true }), running)).toBeNull()
  })

  test('D and E need a started task; Space needs a task that can start; nothing without a task', () => {
    expect(shortcutFor(key('d'), idle)).toBeNull()
    expect(shortcutFor(key('e'), idle)).toBeNull()
    expect(shortcutFor(key(' '), { ...idle, canStart: false })).toBeNull()
    expect(shortcutFor(key(' '), { ...running, hasHead: false })).toBeNull()
    expect(shortcutFor(key('d'), { ...running, hasHead: false })).toBeNull()
  })

  test('during the check-in D and E work but Space does not', () => {
    const ci = { ...running, checkIn: true }
    expect(shortcutFor(key('d'), ci)).toBe('done')
    expect(shortcutFor(key('e'), ci)).toBe('extend')
    expect(shortcutFor(key(' '), ci)).toBeNull()
  })

  test('non-Latin layouts fall back to the physical key; Latin letters on other keys still win', () => {
    expect(shortcutFor(key('в', { code: 'KeyD' }), running)).toBe('done')
    expect(shortcutFor(key('у', { code: 'KeyE' }), running)).toBe('extend')
    expect(shortcutFor(key('в', { code: 'KeyF' }), running)).toBeNull()
    // Dvorak: the key labelled D sits at code KeyE; it types 'd', which means "done"
    expect(shortcutFor(key('d', { code: 'KeyE' }), running)).toBe('done')
  })

  test('other keys do nothing', () => {
    expect(shortcutFor(key('x'), running)).toBeNull()
    expect(shortcutFor(key('Enter'), running)).toBeNull()
  })
})
