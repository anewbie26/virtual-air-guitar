import {
  PINCH_CONFIRM_FRAMES,
  PINCH_ENTER,
  PINCH_EXIT,
} from '../constants.js'

/**
 * Pinch distance as a fraction of hand size, never pixels.
 * Hand size is wrist (0) to middle-finger MCP (9).
 */
export function pinchRatio(landmarks) {
  if (!landmarks || landmarks.length < 21) return null
  const wrist = landmarks[0]
  const middleBase = landmarks[9]
  const handSize = Math.hypot(
    wrist.x - middleBase.x,
    wrist.y - middleBase.y,
  )
  if (handSize < 1e-5) return null
  const thumb = landmarks[4]
  const index = landmarks[8]
  return (
    Math.hypot(thumb.x - index.x, thumb.y - index.y) / handSize
  )
}

/**
 * Hysteresis state machine: enter pinch below `enter`, leave above `exit`,
 * and require `confirmFrames` consecutive frames before changing state.
 */
export class PinchTracker {
  constructor({
    enter = PINCH_ENTER,
    exit = PINCH_EXIT,
    confirmFrames = PINCH_CONFIRM_FRAMES,
  } = {}) {
    this.enter = enter
    this.exit = exit
    this.confirmFrames = confirmFrames
    this.pinching = false
    this.pending = 0
    this.lastRatio = null
  }

  setThresholds({ pinchEnter, pinchExit } = {}) {
    if (Number.isFinite(pinchEnter)) this.enter = pinchEnter
    if (Number.isFinite(pinchExit)) this.exit = pinchExit
    // Keep a real gap even if calibration produced odd values.
    if (this.exit <= this.enter) this.exit = this.enter + 0.08
  }

  update(landmarks) {
    const ratio = pinchRatio(landmarks)
    this.lastRatio = ratio
    if (ratio === null) {
      return { pinching: this.pinching, ratio }
    }

    const desired = this.pinching
      ? !(ratio > this.exit) // stay pinched until clearly open
      : ratio < this.enter // start pinching only when clearly closed

    if (desired === this.pinching) {
      this.pending = 0
    } else {
      this.pending += 1
      if (this.pending >= this.confirmFrames) {
        this.pinching = desired
        this.pending = 0
      }
    }

    return { pinching: this.pinching, ratio }
  }

  reset() {
    this.pinching = false
    this.pending = 0
    this.lastRatio = null
  }
}
