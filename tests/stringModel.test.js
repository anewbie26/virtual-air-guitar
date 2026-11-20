import { describe, expect, it } from 'vitest'
import {
  StringModel,
  lengthToFrequency,
} from '../src/gestures/stringModel.js'

describe('lengthToFrequency', () => {
  it('maps the reference length to F_REF', () => {
    // L_REF = 0.35, F_REF = 220, min side = 1000 -> length 350 px.
    expect(lengthToFrequency(350, 1000, 1000)).toBeCloseTo(220, 5)
  })

  it('gives higher notes to shorter strings', () => {
    const long = lengthToFrequency(700, 1000, 1000)
    const short = lengthToFrequency(175, 1000, 1000)
    expect(short).toBeGreaterThan(long)
    expect(short).toBeCloseTo(440, 5)
  })

  it('uses the shorter screen side on non-square displays', () => {
    const landscape = lengthToFrequency(350, 1600, 900)
    const portrait = lengthToFrequency(350, 900, 1600)
    expect(landscape).toBeCloseTo(portrait, 5)
  })

  it('clamps to the audible range', () => {
    expect(lengthToFrequency(1, 1000, 1000)).toBe(1200)
    expect(lengthToFrequency(5000, 1000, 1000)).toBe(80)
  })
})

describe('StringModel', () => {
  function modelWith(viewport = [1000, 1000]) {
    const model = new StringModel()
    model.setViewport(...viewport)
    return model
  }

  it('creates a string and assigns ids/colours', () => {
    const model = modelWith()
    const string = model.create({ x: 100, y: 100 }, { x: 300, y: 100 })
    expect(string.id).toBe(1)
    expect(string.colorIndex).toBe(0)
    expect(model.strings).toHaveLength(1)
  })

  it('rejects strings shorter than the minimum', () => {
    const model = modelWith()
    expect(model.create({ x: 100, y: 100 }, { x: 101, y: 100 })).toBeNull()
  })

  it('respects the string cap', () => {
    const model = new StringModel({ maxStrings: 2 })
    model.setViewport(1000, 1000)
    model.create({ x: 100, y: 100 }, { x: 300, y: 100 })
    model.create({ x: 100, y: 200 }, { x: 300, y: 200 })
    expect(model.create({ x: 100, y: 300 }, { x: 300, y: 300 })).toBeNull()
    expect(model.strings).toHaveLength(2)
  })

  it('rescales endpoints on viewport changes', () => {
    const model = modelWith([1000, 1000])
    model.create({ x: 100, y: 100 }, { x: 300, y: 200 })
    model.setViewport(2000, 500)
    const [string] = model.strings
    expect(string.a).toEqual({ x: 200, y: 50 })
    expect(string.b).toEqual({ x: 600, y: 100 })
  })

  it('grabs the nearest endpoint within the endpoint radius', () => {
    const model = modelWith()
    const string = model.create({ x: 100, y: 100 }, { x: 500, y: 100 })
    const grab = model.findGrab({ x: 108, y: 104 })
    expect(grab?.string).toBe(string)
    expect(grab?.end).toBe('a')
  })

  it('grabs a segment and chooses its nearer endpoint', () => {
    const model = modelWith()
    const string = model.create({ x: 100, y: 100 }, { x: 500, y: 100 })
    const grab = model.findGrab({ x: 400, y: 130 })
    expect(grab?.string).toBe(string)
    expect(grab?.end).toBe('b')
  })

  it('never grabs an endpoint already held by the other hand', () => {
    const model = modelWith()
    const string = model.create({ x: 100, y: 100 }, { x: 500, y: 100 })
    model.setHeld(string, 'a', true)
    const grab = model.findGrab({ x: 102, y: 100 })
    expect(grab?.end).not.toBe('a')
  })

  it('computes frequency from the current length', () => {
    const model = modelWith()
    const string = model.create({ x: 0, y: 0 }, { x: 350, y: 0 })
    expect(model.frequencyOf(string)).toBeCloseTo(220, 5)
  })

  it('clears all strings', () => {
    const model = modelWith()
    model.create({ x: 100, y: 100 }, { x: 300, y: 100 })
    model.clear()
    expect(model.strings).toHaveLength(0)
  })
})
