import { describe, expect, it } from 'vitest'
import {
  distance,
  pointToSegment,
  segmentIntersection,
} from '../src/gestures/geometry.js'

describe('segmentIntersection', () => {
  it('finds a proper crossing and its parameters', () => {
    const hit = segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    )
    expect(hit).not.toBeNull()
    expect(hit.t).toBeCloseTo(0.5)
    expect(hit.u).toBeCloseTo(0.5)
    expect(hit.point.x).toBeCloseTo(5)
    expect(hit.point.y).toBeCloseTo(5)
  })

  it('rejects parallel segments', () => {
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ),
    ).toBeNull()
  })

  it('rejects segments that would cross only if extended', () => {
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 6, y: -5 },
        { x: 6, y: 5 },
      ),
    ).toBeNull()
  })

  it('catches a fast movement that fully crosses a string', () => {
    // Simulates tunneling: a huge step with no sampled point on the string.
    const hit = segmentIntersection(
      { x: 50, y: 0 },
      { x: 50, y: 500 },
      { x: 0, y: 250 },
      { x: 100, y: 250 },
    )
    expect(hit).not.toBeNull()
    expect(hit.t).toBeCloseTo(0.5)
  })
})

describe('pointToSegment', () => {
  it('measures perpendicular distance inside the segment', () => {
    const result = pointToSegment(
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    )
    expect(result.distance).toBeCloseTo(5)
    expect(result.t).toBeCloseTo(0.5)
  })

  it('clamps to the nearest endpoint outside the segment', () => {
    const result = pointToSegment(
      { x: -5, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    )
    expect(result.distance).toBeCloseTo(5)
    expect(result.t).toBe(0)
  })

  it('handles a degenerate segment', () => {
    const result = pointToSegment(
      { x: 3, y: 4 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    )
    expect(result.distance).toBeCloseTo(5)
    expect(result.closest).toEqual({ x: 0, y: 0 })
  })
})

describe('distance', () => {
  it('is Euclidean', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})
