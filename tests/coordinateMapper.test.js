import { describe, expect, it } from 'vitest'
import { createCoordinateMapper } from '../src/tracking/coordinateMapper.js'

function mapperFor(config) {
  const mapper = createCoordinateMapper()
  mapper.update(config)
  return mapper
}

function expectPoint(actual, x, y) {
  expect(actual.x).toBeCloseTo(x, 5)
  expect(actual.y).toBeCloseTo(y, 5)
}

describe('coordinateMapper', () => {
  it('maps the centre to the display centre and accounts for cover cropping', () => {
    // 16:9 video into a 4:3 box -> width overflows and is cropped.
    const mapper = mapperFor({
      videoWidth: 1280,
      videoHeight: 720,
      displayWidth: 800,
      displayHeight: 600,
      mirrored: false,
    })

    expectPoint(mapper.mapPoint({ x: 0.5, y: 0.5 }), 400, 300)
    expectPoint(mapper.mapPoint({ x: 0, y: 0 }), -133.33333, 0)
    expectPoint(mapper.mapPoint({ x: 1, y: 1 }), 933.33333, 600)
  })

  it('mirrors X for selfie cameras', () => {
    const mapper = mapperFor({
      videoWidth: 1280,
      videoHeight: 720,
      displayWidth: 800,
      displayHeight: 600,
      mirrored: true,
    })

    expectPoint(mapper.mapPoint({ x: 0.5, y: 0.5 }), 400, 300)
    expectPoint(mapper.mapPoint({ x: 0, y: 0 }), 933.33333, 0)
    expectPoint(mapper.mapPoint({ x: 1, y: 1 }), -133.33333, 600)
  })

  it('handles portrait video in a landscape display', () => {
    const mapper = mapperFor({
      videoWidth: 720,
      videoHeight: 1280,
      displayWidth: 800,
      displayHeight: 600,
      mirrored: false,
    })

    expectPoint(mapper.mapPoint({ x: 0.5, y: 0.5 }), 400, 300)
    expectPoint(mapper.mapPoint({ x: 0.5, y: 0 }), 400, -411.11111)
    expectPoint(mapper.mapPoint({ x: 0.5, y: 1 }), 400, 1011.11111)
  })

  it('handles a rotated display without hardcoded offsets', () => {
    const mapper = mapperFor({
      videoWidth: 1280,
      videoHeight: 720,
      displayWidth: 600,
      displayHeight: 800,
      mirrored: false,
    })

    expectPoint(mapper.mapPoint({ x: 0.5, y: 0.5 }), 300, 400)
    // Height overflows now, so x stays flush and y crops.
    expectPoint(mapper.mapPoint({ x: 0, y: 0 }), -411.11111, 0)
  })

  it('maps a whole landmark array consistently', () => {
    const mapper = mapperFor({
      videoWidth: 1000,
      videoHeight: 1000,
      displayWidth: 500,
      displayHeight: 500,
      mirrored: false,
    })

    const mapped = mapper.mapLandmarks([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])
    expectPoint(mapped[0], 0, 0)
    expectPoint(mapped[1], 500, 500)
  })
})
