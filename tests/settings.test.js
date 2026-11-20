import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from '../src/settings.js'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  }
}

describe('sanitizeSettings', () => {
  it('keeps valid values', () => {
    const settings = sanitizeSettings({
      pinchEnter: 0.22,
      pinchExit: 0.38,
      sensitivity: 1.4,
      volume: 0.5,
      mode: 'triangle',
    })
    expect(settings).toEqual({
      pinchEnter: 0.22,
      pinchExit: 0.38,
      sensitivity: 1.4,
      volume: 0.5,
      mode: 'triangle',
    })
  })

  it('clamps ranges and rejects unknown modes', () => {
    const settings = sanitizeSettings({
      pinchEnter: -1,
      pinchExit: 5,
      sensitivity: 99,
      volume: 9,
      mode: 'kazoo',
    })
    expect(settings.pinchEnter).toBe(0.08)
    expect(settings.pinchExit).toBe(0.9)
    expect(settings.sensitivity).toBe(2)
    expect(settings.volume).toBe(1)
    expect(settings.mode).toBe(DEFAULT_SETTINGS.mode)
  })

  it('keeps exit above enter', () => {
    const settings = sanitizeSettings({ pinchEnter: 0.5, pinchExit: 0.1 })
    expect(settings.pinchExit).toBeGreaterThan(settings.pinchEnter)
  })

  it('falls back to defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS)
  })
})

describe('settings persistence', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, volume: 0.25 }, storage)
    const loaded = loadSettings(storage)
    expect(loaded.volume).toBe(0.25)
  })

  it('survives invalid JSON', () => {
    const storage = memoryStorage({
      'virtual-air-guitar:settings:v1': '{not json',
    })
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })

  it('survives a storage exception', () => {
    const storage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(DEFAULT_SETTINGS, storage)).not.toThrow()
  })
})
