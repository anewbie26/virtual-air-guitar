import { describe, expect, it } from 'vitest'
import { pinchRatio } from '../src/gestures/pinch.js'
import { createVirtualHand } from '../src/sim/virtualHand.js'

describe('createVirtualHand', () => {
  it('produces 21 landmarks', () => {
    const hand = createVirtualHand({ x: 0.5, y: 0.5 })
    expect(hand.points).toHaveLength(21)
    expect(hand.points.every((point) => Number.isFinite(point.x))).toBe(true)
  })

  it('is clearly pinched when requested', () => {
    const hand = createVirtualHand({ x: 0.5, y: 0.5, pinching: true })
    expect(pinchRatio(hand.points)).toBeLessThan(0.25)
  })

  it('is clearly open when requested', () => {
    const hand = createVirtualHand({ x: 0.5, y: 0.5, pinching: false })
    expect(pinchRatio(hand.points)).toBeGreaterThan(0.4)
  })

  it('puts an open index tip on the anchor for plucking', () => {
    const hand = createVirtualHand({ x: 0.37, y: 0.61, pinching: false })
    expect(hand.points[8].x).toBeCloseTo(0.37, 6)
    expect(hand.points[8].y).toBeCloseTo(0.61, 6)
  })

  it('keeps the hand size independent of the anchor', () => {
    const a = createVirtualHand({ x: 0.2, y: 0.3 })
    const b = createVirtualHand({ x: 0.8, y: 0.7 })
    const size = (hand) =>
      Math.hypot(
        hand.points[0].x - hand.points[9].x,
        hand.points[0].y - hand.points[9].y,
      )
    expect(size(a)).toBeCloseTo(size(b), 8)
  })
})
