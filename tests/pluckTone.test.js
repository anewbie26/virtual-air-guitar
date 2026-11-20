import { describe, expect, it } from 'vitest'
import { pluckTone } from '../src/audio/pluckVoice.js'

describe('pluckTone', () => {
  it('stays inside PluckSynth parameter ranges', () => {
    for (const frequency of [80, 220, 1200]) {
      for (const velocity of [0.05, 0.5, 1]) {
        const tone = pluckTone(frequency, velocity)
        expect(tone.attackNoise).toBeGreaterThanOrEqual(0.4)
        expect(tone.attackNoise).toBeLessThanOrEqual(1.3)
        expect(tone.dampening).toBeGreaterThanOrEqual(1500)
        expect(tone.dampening).toBeLessThanOrEqual(5000)
        expect(tone.resonance).toBeGreaterThanOrEqual(0.95)
        expect(tone.resonance).toBeLessThanOrEqual(0.98)
        expect(tone.release).toBeGreaterThanOrEqual(1.6)
        expect(tone.release).toBeLessThanOrEqual(3.2)
      }
    }
  })

  it('makes a harder pluck brighter, louder and more sustained', () => {
    const soft = pluckTone(220, 0.2)
    const hard = pluckTone(220, 1)
    expect(hard.attackNoise).toBeGreaterThan(soft.attackNoise)
    expect(hard.dampening).toBeGreaterThan(soft.dampening)
    expect(hard.resonance).toBeGreaterThan(soft.resonance)
    expect(hard.release).toBeGreaterThan(soft.release)
  })

  it('keeps low notes warmer and high notes brighter', () => {
    const low = pluckTone(100, 0.7)
    const high = pluckTone(1000, 0.7)
    expect(high.dampening).toBeGreaterThan(low.dampening)
    expect(high.release).toBeLessThan(low.release)
  })

  it('clamps out-of-range input', () => {
    const low = pluckTone(-50, -3)
    const high = pluckTone(99999, 9)
    expect(low).toEqual(pluckTone(80, 0.05))
    expect(high).toEqual(pluckTone(1200, 1))
  })
})
