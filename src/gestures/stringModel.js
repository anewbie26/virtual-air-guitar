import {
  ENDPOINT_GRAB_BONUS,
  FREQ_MAX,
  FREQ_MIN,
  F_REF,
  GRAB_RADIUS,
  L_REF,
  MAX_STRINGS,
  MIN_STRING_LENGTH,
} from '../constants.js'
import { distance, pointToSegment } from './geometry.js'

/**
 * Pitch is inversely proportional to normalized length (shorter screen side):
 *   f = F_REF * (L_REF / L)
 * Long string -> low note, short string -> high note.
 */
export function lengthToFrequency(lengthPx, width, height) {
  const minSide = Math.max(1, Math.min(width, height))
  const normalized = lengthPx / minSide
  if (normalized < 1e-6) return FREQ_MAX
  const frequency = F_REF * (L_REF / normalized)
  return Math.min(FREQ_MAX, Math.max(FREQ_MIN, frequency))
}

/**
 * Strings live in canvas CSS pixels. On resize/rotation their endpoints are
 * scaled proportionally so the instrument keeps its shape.
 */
export class StringModel {
  constructor({ maxStrings = MAX_STRINGS } = {}) {
    this.maxStrings = maxStrings
    this.strings = []
    this.nextId = 1
    this.width = 0
    this.height = 0
  }

  setViewport(width, height) {
    if (!width || !height) return
    if (this.width > 0 && this.height > 0) {
      const sx = width / this.width
      const sy = height / this.height
      for (const string of this.strings) {
        string.a.x *= sx
        string.a.y *= sy
        string.b.x *= sx
        string.b.y *= sy
      }
    }
    this.width = width
    this.height = height
  }

  create(a, b) {
    if (this.strings.length >= this.maxStrings) return null
    const minSide = Math.min(this.width, this.height) || 1
    if (distance(a, b) < MIN_STRING_LENGTH * minSide) return null

    const string = {
      id: this.nextId,
      a: { x: a.x, y: a.y },
      b: { x: b.x, y: b.y },
      colorIndex: this.nextId - 1,
      heldA: false,
      heldB: false,
      ring: null,
      lastFrequency: 0,
    }
    this.nextId += 1
    this.strings.push(string)
    return string
  }

  get(id) {
    return this.strings.find((string) => string.id === id) ?? null
  }

  clear() {
    this.strings = []
  }

  setHeld(string, end, held) {
    if (end === 'a') string.heldA = held
    else string.heldB = held
  }

  moveEndpoint(string, end, point) {
    string[end] = { x: point.x, y: point.y }
  }

  lengthOf(string) {
    return distance(string.a, string.b)
  }

  frequencyOf(string) {
    return lengthToFrequency(
      this.lengthOf(string),
      this.width || 1,
      this.height || 1,
    )
  }

  /**
   * Grab wins over create: find the nearest free endpoint within the endpoint
   * radius, otherwise the nearest string segment and its nearer free endpoint.
   */
  findGrab(point, radiusScale = 1) {
    const minSide = Math.min(this.width, this.height) || 1
    const radius = GRAB_RADIUS * minSide * radiusScale
    const endpointRadius = radius + ENDPOINT_GRAB_BONUS * minSide * radiusScale

    let best = null

    for (const string of this.strings) {
      if (!string.heldA) {
        const d = distance(point, string.a)
        if (d <= endpointRadius && (!best || d < best.distance)) {
          best = { string, end: 'a', distance: d }
        }
      }
      if (!string.heldB) {
        const d = distance(point, string.b)
        if (d <= endpointRadius && (!best || d < best.distance)) {
          best = { string, end: 'b', distance: d }
        }
      }
    }
    if (best) return best

    for (const string of this.strings) {
      const hit = pointToSegment(point, string.a, string.b)
      if (hit.distance > radius) continue

      // Prefer the nearer free end; fall back to the other free end.
      const nearer = hit.t < 0.5 ? 'a' : 'b'
      const farther = nearer === 'a' ? 'b' : 'a'
      let end = null
      if (nearer === 'a' && !string.heldA) end = 'a'
      else if (nearer === 'b' && !string.heldB) end = 'b'
      else if (farther === 'a' && !string.heldA) end = 'a'
      else if (farther === 'b' && !string.heldB) end = 'b'
      if (!end) continue

      if (!best || hit.distance < best.distance) {
        best = { string, end, distance: hit.distance }
      }
    }

    return best
  }
}
