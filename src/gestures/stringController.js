import { PinchTracker } from './pinch.js'
import { PluckDetector } from './pluck.js'
import { StringModel } from './stringModel.js'

/**
 * Turns per-hand pinch state into string creation, grabbing and resizing.
 *
 * Rules:
 * - A pinch near a string grabs its nearer free endpoint (grab wins).
 * - If both hands pinch and neither grabbed anything, a string is created
 *   between the two pinch points and both ends stay held.
 * - While held, an endpoint follows the pinch point; on release it stays put.
 * - A hand that disappears briefly keeps its endpoint (tracking-loss grace is
 *   applied by the tracking runtime before hands vanish from this list).
 */
export class StringController {
  constructor({ settings }) {
    this.model = new StringModel()
    this.settings = settings
    this.trackers = new Map()
    this.grabs = new Map()
    this.wasPinching = new Map()
    this.pluckDetector = new PluckDetector()
    this.pinchStates = []
    this.createBlockedUntil = 0
  }

  setSettings(settings) {
    this.settings = settings
    for (const tracker of this.trackers.values()) {
      tracker.setThresholds(settings)
    }
  }

  ensureTracker(label) {
    let tracker = this.trackers.get(label)
    if (!tracker) {
      tracker = new PinchTracker({
        enter: this.settings.pinchEnter,
        exit: this.settings.pinchExit,
      })
      this.trackers.set(label, tracker)
    }
    return tracker
  }

  update({ hands, now, width, height }) {
    this.model.setViewport(width, height)

    const fresh = hands.filter((hand) => (hand.alpha ?? 1) >= 0.999)
    const presentLabels = new Set(hands.map((hand) => hand.label))
    const pinchingLabels = new Set()
    const pointsByLabel = new Map()
    const resized = []

    for (const hand of fresh) {
      const tracker = this.ensureTracker(hand.label)
      const state = tracker.update(hand.smooth)
      const point = {
        x: (hand.points[4].x + hand.points[8].x) / 2,
        y: (hand.points[4].y + hand.points[8].y) / 2,
      }
      pointsByLabel.set(hand.label, point)

      // Hysteresis keeps the logical pinch active for the two-frame release
      // confirmation. While the fingers are visibly open, freeze the endpoint
      // instead of dragging it to the widened thumb/index midpoint.
      const ratio = tracker.lastRatio
      const visuallyClosed =
        ratio === null || ratio <= this.settings.pinchExit
      const activePinch = state.pinching && visuallyClosed
      if (activePinch) pinchingLabels.add(hand.label)

      const was = this.wasPinching.get(hand.label) ?? false
      if (state.pinching) {
        let grab = this.grabs.get(hand.label)

        // Attempt a grab only on the rising edge; otherwise a free pinch
        // would keep snapping onto strings while the hand moves.
        if (!grab && !was && visuallyClosed) {
          const found = this.model.findGrab(
            point,
            this.settings.sensitivity,
          )
          if (found) {
            grab = { stringId: found.string.id, end: found.end }
            this.grabs.set(hand.label, grab)
            this.model.setHeld(found.string, found.end, true)
          }
        }

        if (grab && visuallyClosed) {
          const string = this.model.get(grab.stringId)
          if (string) {
            const previous = string[grab.end]
            const moved = Math.hypot(
              point.x - previous.x,
              point.y - previous.y,
            )
            this.model.moveEndpoint(string, grab.end, point)
            if (moved > 0.5) resized.push(string)
          }
        }
      } else if (was) {
        this.release(hand.label)
      }

      this.wasPinching.set(hand.label, state.pinching)
    }

    // A hand that is truly gone (past the grace window) releases its end.
    for (const [label, grab] of [...this.grabs]) {
      if (presentLabels.has(label)) continue
      const string = this.model.get(grab.stringId)
      if (string) this.model.setHeld(string, grab.end, false)
      this.grabs.delete(label)
    }
    for (const label of [...this.wasPinching.keys()]) {
      if (!presentLabels.has(label)) {
        this.wasPinching.delete(label)
        this.trackers.get(label)?.reset()
      }
    }

    // Create only when both hands pinch and neither is holding anything.
    const left = pointsByLabel.get('Left')
    const right = pointsByLabel.get('Right')
    if (
      left &&
      right &&
      pinchingLabels.has('Left') &&
      pinchingLabels.has('Right') &&
      !this.grabs.has('Left') &&
      !this.grabs.has('Right') &&
      now >= this.createBlockedUntil
    ) {
      const string = this.model.create(left, right)
      if (string) {
        this.grabs.set('Left', { stringId: string.id, end: 'a' })
        this.grabs.set('Right', { stringId: string.id, end: 'b' })
        this.model.setHeld(string, 'a', true)
        this.model.setHeld(string, 'b', true)
      } else {
        // Do not retry every frame when full or too short.
        this.createBlockedUntil = now + 300
      }
    }

    const plucks = this.pluckDetector.update({
      hands: fresh,
      strings: this.model.strings,
      width,
      height,
      now,
      pinchingLabels,
      sensitivity: this.settings.sensitivity,
    })

    this.pinchStates = [...presentLabels].map((label) => {
      const tracker = this.trackers.get(label)
      return {
        label,
        pinching: tracker?.pinching ?? false,
        ratio: tracker?.lastRatio ?? null,
      }
    })

    return { plucks, pinchStates: this.pinchStates, resized }
  }

  release(label) {
    const grab = this.grabs.get(label)
    if (!grab) return
    const string = this.model.get(grab.stringId)
    if (string) this.model.setHeld(string, grab.end, false)
    this.grabs.delete(label)
  }

  clear() {
    this.model.clear()
    this.grabs.clear()
    this.wasPinching.clear()
    this.pluckDetector.reset()
    for (const tracker of this.trackers.values()) tracker.reset()
  }
}
