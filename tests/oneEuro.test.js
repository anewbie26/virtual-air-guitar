import { describe, expect, it } from 'vitest'
import { OneEuroFilter, OneEuroPointFilter } from '../src/tracking/oneEuro.js'

describe('OneEuroFilter', () => {
  it('returns the first sample unchanged', () => {
    const filter = new OneEuroFilter()
    expect(filter.filter(0.42, 0)).toBe(0.42)
  })

  it('keeps a constant signal constant', () => {
    const filter = new OneEuroFilter()
    let value = 0
    for (let i = 0; i < 120; i += 1) {
      value = filter.filter(0.3, i / 60)
    }
    expect(value).toBeCloseTo(0.3, 6)
  })

  it('smooths a step instead of jumping instantly', () => {
    const filter = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 })
    filter.filter(0, 0)
    const afterOneFrame = filter.filter(1, 1 / 60)

    expect(afterOneFrame).toBeGreaterThan(0)
    expect(afterOneFrame).toBeLessThan(0.5)
  })

  it('converges after the signal settles', () => {
    const filter = new OneEuroFilter({ minCutoff: 4, beta: 0 })
    filter.filter(0, 0)
    let value = 0
    for (let i = 1; i <= 240; i += 1) {
      value = filter.filter(1, i / 60)
    }
    expect(value).toBeGreaterThan(0.95)
    expect(value).toBeLessThanOrEqual(1)
  })

  it('never produces NaN for duplicate or backwards timestamps', () => {
    const filter = new OneEuroFilter()
    filter.filter(0.2, 1)
    const a = filter.filter(0.4, 1)
    const b = filter.filter(0.1, 0.5)
    expect(Number.isFinite(a)).toBe(true)
    expect(Number.isFinite(b)).toBe(true)
  })

  it('resets back to the initial state', () => {
    const filter = new OneEuroFilter()
    filter.filter(1, 0)
    filter.filter(1, 1)
    filter.reset()
    expect(filter.filter(0.7, 2)).toBe(0.7)
  })
})

describe('OneEuroPointFilter', () => {
  it('filters X and Y independently', () => {
    const filter = new OneEuroPointFilter({ minCutoff: 1, beta: 0 })
    const first = filter.filter({ x: 0.2, y: 0.8 }, 0)
    expect(first).toEqual({ x: 0.2, y: 0.8 })

    const second = filter.filter({ x: 0.3, y: 0.7 }, 1 / 60)
    expect(second.x).toBeGreaterThan(0.2)
    expect(second.x).toBeLessThan(0.3)
    expect(second.y).toBeGreaterThan(0.7)
    expect(second.y).toBeLessThan(0.8)
  })
})
