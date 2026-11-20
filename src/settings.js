import {
  PINCH_ENTER,
  PINCH_EXIT,
  SENSITIVITY_MAX,
  SENSITIVITY_MIN,
} from './constants.js'
import { SOUND_MODES } from './audio/engine.js'

const STORAGE_KEY = 'virtual-air-guitar:settings:v1'

export const DEFAULT_SETTINGS = {
  pinchEnter: PINCH_ENTER,
  pinchExit: PINCH_EXIT,
  sensitivity: 1,
  volume: 0.8,
  mode: 'pluck',
}

const MODE_IDS = new Set(SOUND_MODES.map((option) => option.id))

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Keep stored values usable even after a manual edit or a version change. */
export function sanitizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const enter = Number.isFinite(source.pinchEnter)
    ? clamp(source.pinchEnter, 0.08, 0.6)
    : DEFAULT_SETTINGS.pinchEnter
  const exit = Number.isFinite(source.pinchExit)
    ? source.pinchExit
    : DEFAULT_SETTINGS.pinchExit
  const exitClamped = clamp(Math.max(exit, enter + 0.05), enter + 0.05, 0.9)

  return {
    pinchEnter: enter,
    pinchExit: exitClamped,
    sensitivity: Number.isFinite(source.sensitivity)
      ? clamp(source.sensitivity, SENSITIVITY_MIN, SENSITIVITY_MAX)
      : DEFAULT_SETTINGS.sensitivity,
    volume: Number.isFinite(source.volume)
      ? clamp(source.volume, 0, 1)
      : DEFAULT_SETTINGS.volume,
    mode: MODE_IDS.has(source.mode) ? source.mode : DEFAULT_SETTINGS.mode,
  }
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    if (!text) return { ...DEFAULT_SETTINGS }
    return sanitizeSettings(JSON.parse(text))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)))
  } catch {
    // Private browsing or a full quota: settings simply do not persist.
  }
}

export function resetSettings() {
  return { ...DEFAULT_SETTINGS }
}
