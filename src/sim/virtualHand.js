/**
 * Builds a plausible 21-landmark hand in normalized video coordinates.
 * Used only by the simulation input; the real app gets these from MediaPipe.
 *
 * `x`/`y` are normalized to the video frame. `pinching` moves thumb tip (4)
 * and index tip (8) together to a ratio of 0.12 of the wrist->middle-MCP size,
 * comfortably below the enter threshold. Open hands sit at 0.65, well above
 * the exit threshold.
 */
export function createVirtualHand({ x, y, pinching = false, hand = 'Right' }) {
  const h = 0.1
  const points = Array.from({ length: 21 }, () => ({ x, y, z: 0 }))
  const put = (index, dx, dy) => {
    points[index] = { x: x + dx * h, y: y + dy * h, z: 0 }
  }

  // Wrist (0) and middle MCP (9) define hand size exactly as 1.0h.
  put(0, 0, 1.2)
  put(9, 0, 0.2)

  // Index finger; the tip stays on the anchor when the hand is open.
  put(5, -0.35, 0.35)
  put(6, -0.35, 0.1)
  put(7, -0.2, 0)
  put(8, pinching ? 0.06 : 0, 0)

  // Thumb.
  put(1, -0.25, 1.0)
  put(2, -0.55, 0.8)
  put(3, -0.75, 0.55)
  put(4, pinching ? -0.06 : -0.65, 0)

  // Middle finger.
  put(10, 0, -0.1)
  put(11, 0, -0.35)
  put(12, 0.05, -0.6)

  // Ring finger.
  put(13, 0.3, 0.35)
  put(14, 0.4, 0.05)
  put(15, 0.45, -0.15)
  put(16, 0.5, -0.4)

  // Pinky.
  put(17, 0.6, 0.45)
  put(18, 0.75, 0.25)
  put(19, 0.85, 0.05)
  put(20, 0.95, -0.15)

  return { points, hand }
}
