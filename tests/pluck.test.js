import { describe, expect, it } from 'vitest'
import { PluckDetector } from '../src/gestures/pluck.js'

const WIDTH = 600
const HEIGHT = 600
const MIN_SIDE = 600

function makeHand(label, tipPoints) {
  const rawPoints = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))
  for (const [index, point] of Object.entries(tipPoints)) {
    rawPoints[Number(index)] = point
  }
  return { label, alpha: 1, rawPoints }
}

function stringAt(id, y, x1 = 0, x2 = 200) {
  return { id, a: { x: x1, y }, b: { x: x2, y } }
}

function run(detector, { hand, strings, now, pinchingLabels = new Set() }) {
  return detector.update({
    hands: [hand],
    strings,
    width: WIDTH,
    height: HEIGHT,
    now,
    pinchingLabels,
    sensitivity: 1,
  })
}

describe('PluckDetector', () => {
  it('fires when a fingertip segment crosses a string', () => {
    const detector = new PluckDetector()
    const string = stringAt(1, 200)

    run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 100 } }),
      strings: [string],
      now: 0,
    })
    const events = run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 300 } }),
      strings: [string],
      now: 16,
    })

    expect(events).toHaveLength(1)
    expect(events[0].string).toBe(string)
    expect(events[0].point.y).toBeCloseTo(200)
    expect(events[0].intensity).toBeGreaterThan(0)
    expect(events[0].frequency).toBeGreaterThan(80)
  })

  it('does not fire when the fingertip is stationary', () => {
    const detector = new PluckDetector()
    const string = stringAt(1, 200)
    run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 200 } }),
      strings: [string],
      now: 0,
    })
    const events = run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 200 } }),
      strings: [string],
      now: 16,
    })
    expect(events).toHaveLength(0)
  })

  it('ignores a pinching hand', () => {
    const detector = new PluckDetector()
    const string = stringAt(1, 200)
    run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 100 } }),
      strings: [string],
      now: 0,
    })
    const events = run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 300 } }),
      strings: [string],
      now: 16,
      pinchingLabels: new Set(['Right']),
    })
    expect(events).toHaveLength(0)
  })

  it('enforces cooldown and requires moving away before re-arming', () => {
    const detector = new PluckDetector()
    const string = stringAt(1, 200)

    run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 100 } }),
      strings: [string],
      now: 0,
    })
    const first = run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 300 } }),
      strings: [string],
      now: 16,
    })
    expect(first).toHaveLength(1)

    // Move far away and back inside the cooldown window.
    run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 500 } }),
      strings: [string],
      now: 32,
    })
    const tooSoon = run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 100 } }),
      strings: [string],
      now: 48,
    })
    expect(tooSoon).toHaveLength(0)

    // Same movement after the cooldown fires again.
    const later = run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 300 } }),
      strings: [string],
      now: 200,
    })
    expect(later).toHaveLength(1)
  })

  it('returns one event per string in crossing order for a strum', () => {
    const detector = new PluckDetector()
    const strings = [stringAt(1, 150), stringAt(2, 250), stringAt(3, 350)]

    run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 100 } }),
      strings,
      now: 0,
    })
    const events = run(detector, {
      hand: makeHand('Right', { 8: { x: 100, y: 400 } }),
      strings,
      now: 16,
    })

    expect(events.map((event) => event.string.id)).toEqual([1, 2, 3])
  })

  it('does not tunnel: a single huge step still crosses', () => {
    const detector = new PluckDetector()
    const string = stringAt(1, 200, 0, 600)
    run(detector, {
      hand: makeHand('Right', { 8: { x: 300, y: -500 } }),
      strings: [string],
      now: 0,
    })
    const events = run(detector, {
      hand: makeHand('Right', { 8: { x: 300, y: 900 } }),
      strings: [string],
      now: 16,
    })
    expect(events).toHaveLength(1)
  })

  it('uses a lower speed threshold when sensitivity is raised', () => {
    const string = stringAt(1, 200)
    const slow = (sensitivity) => {
      const detector = new PluckDetector()
      run(detector, {
        hand: makeHand('Right', { 8: { x: 100, y: 194 } }),
        strings: [string],
        now: 0,
      })
      return detector.update({
        hands: [makeHand('Right', { 8: { x: 100, y: 206 } })],
        strings: [string],
        width: WIDTH,
        height: HEIGHT,
        now: 50,
        pinchingLabels: new Set(),
        sensitivity,
      }).length
    }

    // 12 px / 600 / 0.05s = 0.4 normalized units/s: above the default 0.25
    // threshold, below the 0.5 threshold at half sensitivity.
    expect(slow(1)).toBe(1)
    expect(slow(0.5)).toBe(0)
  })
})
