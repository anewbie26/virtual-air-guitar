/** Small 2-D geometry helpers shared by grabbing and plucking. */

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx
}

/**
 * Proper segment/segment intersection (A->B against C->D).
 * Returns { t, u, point } where t is the position along A->B and u along C->D,
 * or null when parallel, collinear or not crossing. Used instead of a
 * "near the string" check so a fast fingertip cannot tunnel through a string.
 */
export function segmentIntersection(a, b, c, d) {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const sx = d.x - c.x
  const sy = d.y - c.y
  const denominator = cross(rx, ry, sx, sy)
  if (Math.abs(denominator) < 1e-9) return null

  const qpx = c.x - a.x
  const qpy = c.y - a.y
  const t = cross(qpx, qpy, sx, sy) / denominator
  const u = cross(qpx, qpy, rx, ry) / denominator
  if (t < 0 || t > 1 || u < 0 || u > 1) return null

  return {
    t,
    u,
    point: { x: a.x + t * rx, y: a.y + t * ry },
  }
}

/** Closest point on segment A->B to P, plus its distance and parameter. */
export function pointToSegment(p, a, b) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  const t =
    lengthSq === 0
      ? 0
      : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq, 0, 1)
  const closest = { x: a.x + abx * t, y: a.y + aby * t }
  return { distance: distance(p, closest), closest, t }
}
