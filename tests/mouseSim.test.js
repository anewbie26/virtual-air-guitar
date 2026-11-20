import { describe, expect, it, vi } from 'vitest'
import { createMouseSim } from '../src/sim/mouseSim.js'

function fakeElement() {
  const listeners = new Map()
  return {
    listeners,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    setPointerCapture: () => {},
  }
}

function event(patch) {
  return {
    pointerType: 'mouse',
    pointerId: 1,
    button: 0,
    shiftKey: false,
    clientX: 0,
    clientY: 0,
    preventDefault: () => {},
    ...patch,
  }
}

describe('createMouseSim', () => {
  it('shows one free right fingertip while hovering', () => {
    const sim = createMouseSim()
    const element = fakeElement()
    sim.attach(element)
    element.listeners.get('pointermove')(
      event({ clientX: 500, clientY: 250 }),
    )
    const result = sim.sample()
    expect(result.handedness).toHaveLength(1)
    expect(result.handedness[0][0].categoryName).toBe('Right')
    expect(result.landmarks[0][8].x).toBeCloseTo(0.5, 5)
    sim.destroy()
  })

  it('pins hand A with the left button', () => {
    const sim = createMouseSim()
    const element = fakeElement()
    sim.attach(element)
    element.listeners.get('pointerdown')(
      event({ clientX: 200, clientY: 250 }),
    )
    const result = sim.sample()
    expect(result.handedness).toHaveLength(1)
    expect(result.handedness[0][0].categoryName).toBe('Left')
    expect(sim.getState().a).toBe(true)
    sim.destroy()
  })

  it('adds hand B beside A with the right button and allows a string', () => {
    const sim = createMouseSim()
    const element = fakeElement()
    sim.attach(element)
    element.listeners.get('pointerdown')(
      event({ clientX: 200, clientY: 250 }),
    )
    element.listeners.get('pointerdown')(
      event({ button: 2, clientX: 210, clientY: 250 }),
    )
    const result = sim.sample()
    expect(result.handedness.map((entry) => entry[0].categoryName)).toEqual([
      'Left',
      'Right',
    ])
    const ax = result.landmarks[0][8].x
    const bx = result.landmarks[1][8].x
    expect(Math.abs(bx - ax)).toBeGreaterThan(0.2)
    sim.destroy()
  })

  it('releases one hand without releasing the other', () => {
    const sim = createMouseSim()
    const element = fakeElement()
    sim.attach(element)
    element.listeners.get('pointerdown')(
      event({ clientX: 200, clientY: 250 }),
    )
    element.listeners.get('pointerdown')(
      event({ button: 2, clientX: 600, clientY: 250 }),
    )
    element.listeners.get('pointerup')(event({ button: 0 }))
    expect(sim.getState().a).toBe(false)
    expect(sim.getState().b).toBe(true)
    const result = sim.sample()
    expect(result.handedness).toHaveLength(1)
    expect(result.handedness[0][0].categoryName).toBe('Right')
    sim.destroy()
  })

  it('supports Shift+left as hand B', () => {
    const sim = createMouseSim()
    const element = fakeElement()
    sim.attach(element)
    element.listeners.get('pointerdown')(
      event({ shiftKey: true, clientX: 700, clientY: 250 }),
    )
    expect(sim.getState().a).toBe(false)
    expect(sim.getState().b).toBe(true)
    sim.destroy()
  })

  it('moves both ends together while both hands are held', () => {
    const sim = createMouseSim()
    const element = fakeElement()
    sim.attach(element)
    element.listeners.get('pointerdown')(
      event({ clientX: 200, clientY: 250 }),
    )
    element.listeners.get('pointerdown')(
      event({ button: 2, clientX: 600, clientY: 250 }),
    )
    element.listeners.get('pointermove')(
      event({ clientX: 300, clientY: 300 }),
    )
    const result = sim.sample()
    const [left, right] = result.landmarks
    const pinchX = (landmarks) => (landmarks[4].x + landmarks[8].x) / 2
    expect(pinchX(left)).toBeCloseTo(0.3, 5)
    expect(pinchX(right) - pinchX(left)).toBeCloseTo(0.4, 5)
    sim.destroy()
  })

  it('treats a short touch drag as a free plucking fingertip', () => {
    vi.useFakeTimers()
    try {
      const sim = createMouseSim()
      const element = fakeElement()
      sim.attach(element)
      const touch = { pointerType: 'touch', pointerId: 7 }

      element.listeners.get('pointerdown')(
        event({ ...touch, clientX: 200, clientY: 200 }),
      )
      element.listeners.get('pointermove')(
        event({ ...touch, clientX: 600, clientY: 300 }),
      )
      vi.advanceTimersByTime(400)

      const result = sim.sample()
      expect(result.handedness).toHaveLength(1)
      expect(result.handedness[0][0].categoryName).toBe('Right')
      expect(result.landmarks[0][8].x).toBeCloseTo(0.6, 5)
      expect(sim.getState().a).toBe(false)
      sim.destroy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses long press plus a second finger for two pinch hands on touch', () => {
    vi.useFakeTimers()
    try {
      const sim = createMouseSim()
      const element = fakeElement()
      sim.attach(element)

      element.listeners.get('pointerdown')(
        event({ pointerType: 'touch', pointerId: 8, clientX: 200, clientY: 250 }),
      )
      vi.advanceTimersByTime(300)
      expect(sim.getState().a).toBe(true)

      element.listeners.get('pointerdown')(
        event({ pointerType: 'touch', pointerId: 9, clientX: 600, clientY: 250 }),
      )
      expect(sim.getState().b).toBe(true)
      expect(sim.sample().handedness.map((entry) => entry[0].categoryName)).toEqual([
        'Left',
        'Right',
      ])

      element.listeners.get('pointerup')(
        event({ pointerType: 'touch', pointerId: 8 }),
      )
      expect(sim.getState().a).toBe(false)
      expect(sim.getState().b).toBe(true)
      sim.destroy()
    } finally {
      vi.useRealTimers()
    }
  })
})
