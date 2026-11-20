import { describe, expect, it } from 'vitest'
import { PinchTracker, pinchRatio } from '../src/gestures/pinch.js'

// Build 21 landmarks whose thumb-tip/index-tip ratio is controlled while the
// hand size (wrist 0 -> middle MCP 9) stays 0.4.
function landmarksForRatio(ratio) {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
  points[0] = { x: 0.5, y: 0.9 }
  points[9] = { x: 0.5, y: 0.5 }
  points[4] = { x: 0.5, y: 0.4 }
  points[8] = { x: 0.5 + ratio * 0.4, y: 0.4 }
  return points
}

describe('pinchRatio', () => {
  it('measures tip distance relative to hand size', () => {
    expect(pinchRatio(landmarksForRatio(0.25))).toBeCloseTo(0.25, 5)
  })

  it('returns null for malformed input', () => {
    expect(pinchRatio(null)).toBeNull()
    expect(pinchRatio([])).toBeNull()
  })

  it('returns null when the hand has no measurable size', () => {
    const points = landmarksForRatio(0.2)
    points[0] = { x: 0.5, y: 0.5 }
    points[9] = { x: 0.5, y: 0.5 }
    expect(pinchRatio(points)).toBeNull()
  })
})

describe('PinchTracker', () => {
  it('requires two consecutive frames to enter', () => {
    const tracker = new PinchTracker()
    expect(tracker.update(landmarksForRatio(0.5)).pinching).toBe(false)
    expect(tracker.update(landmarksForRatio(0.2)).pinching).toBe(false)
    expect(tracker.update(landmarksForRatio(0.2)).pinching).toBe(true)
  })

  it('stays pinched inside the hysteresis band', () => {
    const tracker = new PinchTracker()
    tracker.update(landmarksForRatio(0.2))
    tracker.update(landmarksForRatio(0.2))
    expect(tracker.update(landmarksForRatio(0.3)).pinching).toBe(true)
    expect(tracker.update(landmarksForRatio(0.39)).pinching).toBe(true)
  })

  it('requires two consecutive frames to release', () => {
    const tracker = new PinchTracker()
    tracker.update(landmarksForRatio(0.2))
    tracker.update(landmarksForRatio(0.2))
    expect(tracker.update(landmarksForRatio(0.5)).pinching).toBe(true)
    expect(tracker.update(landmarksForRatio(0.5)).pinching).toBe(false)
  })

  it('cancels a pending change if the hand reverses', () => {
    const tracker = new PinchTracker()
    tracker.update(landmarksForRatio(0.2))
    expect(tracker.update(landmarksForRatio(0.5)).pinching).toBe(false)
    expect(tracker.update(landmarksForRatio(0.2)).pinching).toBe(false)
  })

  it('honours calibrated thresholds', () => {
    const tracker = new PinchTracker()
    tracker.setThresholds({ pinchEnter: 0.35, pinchExit: 0.5 })
    tracker.update(landmarksForRatio(0.32))
    expect(tracker.update(landmarksForRatio(0.32)).pinching).toBe(true)
    tracker.update(landmarksForRatio(0.6))
    expect(tracker.update(landmarksForRatio(0.6)).pinching).toBe(false)
  })

  it('resets to open', () => {
    const tracker = new PinchTracker()
    tracker.update(landmarksForRatio(0.2))
    tracker.update(landmarksForRatio(0.2))
    tracker.reset()
    expect(tracker.pinching).toBe(false)
    expect(tracker.lastRatio).toBeNull()
  })
})
