import { describe, expect, it } from 'vitest'
import { StringController } from '../src/gestures/stringController.js'
import { createVirtualHand } from '../src/sim/virtualHand.js'

const WIDTH = 1000
const HEIGHT = 1000
const SETTINGS = { pinchEnter: 0.25, pinchExit: 0.4, sensitivity: 1 }

function makeHand(label, x, y, pinching, rawPoints = null) {
  const virtual = createVirtualHand({ x, y, pinching, hand: label })
  const points = virtual.points.map((point) => ({
    x: point.x * WIDTH,
    y: point.y * HEIGHT,
  }))
  return {
    label,
    alpha: 1,
    smooth: virtual.points,
    points,
    rawPoints: rawPoints ?? points,
  }
}

function update(controller, hands, now) {
  return controller.update({ hands, now, width: WIDTH, height: HEIGHT })
}

function openHands() {
  return [makeHand('Left', 0.05, 0.9, false), makeHand('Right', 0.95, 0.9, false)]
}

describe('StringController', () => {
  it('creates a string only after both hands confirm a pinch', () => {
    const controller = new StringController({ settings: { ...SETTINGS } })
    const pinching = () => [
      makeHand('Left', 0.2, 0.5, true),
      makeHand('Right', 0.6, 0.5, true),
    ]

    expect(update(controller, pinching(), 0).pinchStates.every((h) => h.pinching)).toBe(false)
    expect(controller.model.strings).toHaveLength(0)
    update(controller, pinching(), 16)
    expect(controller.model.strings).toHaveLength(1)

    const [string] = controller.model.strings
    expect(string.a.x).toBeCloseTo(200, 0)
    expect(string.b.x).toBeCloseTo(600, 0)
    expect(string.heldA).toBe(true)
    expect(string.heldB).toBe(true)
  })

  it('resizes an endpoint and leaves it in place on release', () => {
    const controller = new StringController({ settings: { ...SETTINGS } })
    const pinching = (rightX) => [
      makeHand('Left', 0.2, 0.5, true),
      makeHand('Right', rightX, 0.5, true),
    ]
    update(controller, pinching(0.6), 0)
    update(controller, pinching(0.6), 16)
    const [string] = controller.model.strings

    update(controller, pinching(0.8), 32)
    expect(string.b.x).toBeCloseTo(800, 0)

    update(controller, openHands(), 48)
    update(controller, openHands(), 64)
    expect(string.heldA).toBe(false)
    expect(string.heldB).toBe(false)
    expect(string.b.x).toBeCloseTo(800, 0)
  })

  it('gives a grab priority over creating a second string', () => {
    const controller = new StringController({ settings: { ...SETTINGS } })
    const initial = () => [
      makeHand('Left', 0.2, 0.5, true),
      makeHand('Right', 0.6, 0.5, true),
    ]
    update(controller, initial(), 0)
    update(controller, initial(), 16)
    update(controller, openHands(), 32)
    update(controller, openHands(), 48)
    const [string] = controller.model.strings

    const nearA = (x, y) => [
      makeHand('Left', x, y, true),
      makeHand('Right', 0.7, 0.2, true),
    ]
    update(controller, nearA(0.2, 0.5), 64)
    update(controller, nearA(0.18, 0.52), 80)

    expect(controller.model.strings).toHaveLength(1)
    expect(string.a.x).toBeCloseTo(180, 0)
    expect(string.a.y).toBeCloseTo(520, 0)
  })

  it('plucks with a non-pinching fingertip and reports pitch', () => {
    const controller = new StringController({ settings: { ...SETTINGS } })
    const pinching = () => [
      makeHand('Left', 0.2, 0.5, true),
      makeHand('Right', 0.6, 0.5, true),
    ]
    update(controller, pinching(), 0)
    update(controller, pinching(), 16)
    update(controller, openHands(), 32)
    update(controller, openHands(), 48)
    // Start the pluck sequence from a clean detector: the release frames
    // above also contain fingertip paths.
    controller.pluckDetector.reset()

    function pluckingHand(y, now) {
      const rawPoints = Array.from({ length: 21 }, () => ({
        x: 400,
        y: 900,
      }))
      rawPoints[8] = { x: 400, y }
      return makeHand('Right', 0.4, 0.9, false, rawPoints)
    }

    update(controller, [pluckingHand(400, 0)], 64)
    const result = update(controller, [pluckingHand(600, 16)], 80)

    expect(result.plucks).toHaveLength(1)
    expect(result.plucks[0].frequency).toBeGreaterThan(80)
    expect(result.plucks[0].frequency).toBeLessThan(1200)
    expect(result.plucks[0].intensity).toBeGreaterThan(0)
  })

  it('clears strings and resets gesture state', () => {
    const controller = new StringController({ settings: { ...SETTINGS } })
    const pinching = () => [
      makeHand('Left', 0.2, 0.5, true),
      makeHand('Right', 0.6, 0.5, true),
    ]
    update(controller, pinching(), 0)
    update(controller, pinching(), 16)
    expect(controller.model.strings).toHaveLength(1)

    controller.clear()
    expect(controller.model.strings).toHaveLength(0)
    expect(controller.grabs.size).toBe(0)
    expect(controller.pluckDetector.previous.size).toBe(0)
  })
})
