import { describe, expect, it } from 'vitest'
import { BODY_EQ, GLIDE_MODES, SOUND_MODES } from '../src/audio/engine.js'

describe('audio graph configuration', () => {
  it('uses decibels for EQ3 gains and frequencies for the crossovers', () => {
    for (const key of ['low', 'mid', 'high']) {
      expect(BODY_EQ[key]).toBeGreaterThanOrEqual(-12)
      expect(BODY_EQ[key]).toBeLessThanOrEqual(12)
    }
    expect(BODY_EQ.lowFrequency).toBeGreaterThanOrEqual(80)
    expect(BODY_EQ.lowFrequency).toBeLessThanOrEqual(300)
    expect(BODY_EQ.highFrequency).toBeGreaterThanOrEqual(2500)
    expect(BODY_EQ.highFrequency).toBeLessThanOrEqual(8000)
  })

  it('does not use the invalid lowValue/midValue/highValue options', () => {
    expect(BODY_EQ).not.toHaveProperty('lowValue')
    expect(BODY_EQ).not.toHaveProperty('midValue')
    expect(BODY_EQ).not.toHaveProperty('highValue')
  })

  it('exposes the expected sound modes', () => {
    expect(SOUND_MODES.map((option) => option.id)).toEqual([
      'pluck',
      'triangle',
      'sawtooth',
      'square',
    ])
    expect(GLIDE_MODES.has('pluck')).toBe(false)
    expect(GLIDE_MODES.has('triangle')).toBe(true)
  })
})
