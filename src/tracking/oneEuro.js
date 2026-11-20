import {
  SMOOTH_BETA,
  SMOOTH_D_CUTOFF,
  SMOOTH_MIN_CUTOFF,
} from '../constants.js'

/**
 * One-Euro filter (Casiez et al. 2012).
 *
 * A low-pass filter whose cutoff rises with speed: slow, precise movement is
 * smoothed hard; fast movement is allowed through so there is little lag.
 * Values here are normalized (0..1), so beta is tuned larger than the
 * pixel-space reference implementation.
 */
class LowPass {
  constructor() {
    this.y = null
  }

  filter(value, alpha) {
    this.y = this.y === null ? value : alpha * value + (1 - alpha) * this.y
    return this.y
  }

  reset() {
    this.y = null
  }
}

export class OneEuroFilter {
  constructor({
    minCutoff = SMOOTH_MIN_CUTOFF,
    beta = SMOOTH_BETA,
    dCutoff = SMOOTH_D_CUTOFF,
  } = {}) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
    this.xFilter = new LowPass()
    this.dxFilter = new LowPass()
    this.lastValue = null
    this.lastTime = null
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  filter(value, timestampSeconds) {
    if (this.lastTime === null || this.lastValue === null) {
      this.lastTime = timestampSeconds
      this.lastValue = value
      this.dxFilter.filter(0, 1)
      return this.xFilter.filter(value, 1)
    }

    // Guard against duplicate timestamps and clock jumps.
    const dt = Math.max(1 / 240, timestampSeconds - this.lastTime)
    const dx = (value - this.lastValue) / dt
    const edx = this.dxFilter.filter(dx, OneEuroFilter.alpha(this.dCutoff, dt))
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    const smoothed = this.xFilter.filter(
      value,
      OneEuroFilter.alpha(cutoff, dt),
    )

    this.lastValue = value
    this.lastTime = timestampSeconds
    return smoothed
  }

  reset() {
    this.xFilter.reset()
    this.dxFilter.reset()
    this.lastValue = null
    this.lastTime = null
  }
}

/** Filters a {x, y} landmark point with independent X/Y One-Euro filters. */
export class OneEuroPointFilter {
  constructor(options) {
    this.fx = new OneEuroFilter(options)
    this.fy = new OneEuroFilter(options)
  }

  filter(point, timestampSeconds) {
    return {
      x: this.fx.filter(point.x, timestampSeconds),
      y: this.fy.filter(point.y, timestampSeconds),
    }
  }

  reset() {
    this.fx.reset()
    this.fy.reset()
  }
}

/** One filter per MediaPipe landmark (21 by default). */
export function createLandmarkFilters(count = 21, options) {
  return Array.from({ length: count }, () => new OneEuroPointFilter(options))
}
