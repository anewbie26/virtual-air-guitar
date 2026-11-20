import {
  PLUCK_COOLDOWN_MS,
  PLUCK_MAX_SPEED,
  PLUCK_MIN_INTENSITY,
  PLUCK_MIN_SPEED,
  PLUCK_REARM_DISTANCE,
  PLUCK_TIPS,
} from '../constants.js'
import { clamp, distance, pointToSegment, segmentIntersection } from './geometry.js'
import { lengthToFrequency } from './stringModel.js'

/**
 * Detects plucks by intersecting each fingertip's movement segment with each
 * string segment. A "near the string" test is deliberately not used: fast
 * swipes would tunnel straight through.
 *
 * Each (string, hand, fingertip) has a cooldown and must move away from the
 * string before it can fire again, so resting or jittering does not retrigger.
 */
export class PluckDetector {
  constructor() {
    this.previous = new Map()
    this.cooldowns = new Map()
    this.armed = new Map()
    this.lastPrune = 0
  }

  reset() {
    this.previous.clear()
    this.cooldowns.clear()
    this.armed.clear()
    this.lastPrune = 0
  }

  update({
    hands,
    strings,
    width,
    height,
    now,
    pinchingLabels = new Set(),
    sensitivity = 1,
  }) {
    const events = []
    if (!strings.length) {
      this.previous.clear()
      return events
    }

    const minSide = Math.max(1, Math.min(width, height))
    const rearmDistance = PLUCK_REARM_DISTANCE * minSide
    const minSpeed = PLUCK_MIN_SPEED / clamp(sensitivity, 0.5, 2)
    const maxSpeed = Math.max(minSpeed + 1e-3, PLUCK_MAX_SPEED)
    const activeKeys = new Set()

    for (const hand of hands) {
      if ((hand.alpha ?? 1) < 0.999) continue
      if (pinchingLabels.has(hand.label)) continue

      for (const tip of PLUCK_TIPS) {
        const key = `${hand.label}:${tip}`
        activeKeys.add(key)
        const current = hand.rawPoints?.[tip]
        if (!current) continue

        const previous = this.previous.get(key)
        this.previous.set(key, {
          x: current.x,
          y: current.y,
          t: now,
        })

        for (const string of strings) {
          const armKey = `${key}:${string.id}`
          const isArmed = this.armed.get(armKey) ?? true
          if (!isArmed) {
            const away = pointToSegment(current, string.a, string.b).distance
            if (away > rearmDistance) this.armed.set(armKey, true)
          }

          if (!previous) continue
          const dt = (now - previous.t) / 1000
          if (dt <= 0) continue

          const movedPx = distance(previous, current)
          const speed = movedPx / minSide / dt
          if (speed < minSpeed) continue

          const hit = segmentIntersection(
            previous,
            current,
            string.a,
            string.b,
          )
          if (!hit) continue
          if (!(this.armed.get(armKey) ?? true)) continue

          const cooldownKey = armKey
          const last = this.cooldowns.get(cooldownKey) ?? -Infinity
          if (now - last < PLUCK_COOLDOWN_MS) continue

          this.cooldowns.set(cooldownKey, now)
          this.armed.set(armKey, false)

          const stringLength = distance(string.a, string.b)
          events.push({
            string,
            point: hit.point,
            t: hit.t,
            intensity: clamp(
              (speed - minSpeed) / (maxSpeed - minSpeed),
              PLUCK_MIN_INTENSITY,
              1,
            ),
            speed,
            frequency: lengthToFrequency(stringLength, width, height),
            hand: hand.label,
            tip,
          })
        }
      }
    }

    // Forget fingertips that are pinching or no longer on screen.
    for (const key of [...this.previous.keys()]) {
      if (!activeKeys.has(key)) this.previous.delete(key)
    }

    // Cooldowns are small; prune occasionally so the map cannot grow forever.
    if (now - this.lastPrune > 5000) {
      this.lastPrune = now
      for (const [key, at] of [...this.cooldowns]) {
        if (now - at > 5000) this.cooldowns.delete(key)
      }
    }

    // Crossing order equals the order along the fingertip's path.
    events.sort((a, b) => a.t - b.t)
    return events
  }
}
