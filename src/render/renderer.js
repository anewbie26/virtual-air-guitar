import { MAX_DPR } from '../constants.js'
import {
  HAND_CONNECTIONS,
  HAND_STYLE,
  STRING_PALETTE,
  STRING_STYLE,
} from './theme.js'

function unitNormal(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-5) return { x: 0, y: -1 }
  return { x: -dy / length, y: dx / length }
}

function stringTint(string) {
  return STRING_PALETTE[string.colorIndex % STRING_PALETTE.length]
}

function tracePolyline(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y)
  }
}

/**
 * Canvas overlay renderer. Runs entirely outside React and only reads the
 * frame state handed to `drawScene`.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
  let cssWidth = 1
  let cssHeight = 1
  let dpr = 1

  function resize() {
    const rect = canvas.getBoundingClientRect()
    cssWidth = Math.max(1, rect.width)
    cssHeight = Math.max(1, rect.height)
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)

    const backingWidth = Math.round(cssWidth * dpr)
    const backingHeight = Math.round(cssHeight * dpr)
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth
      canvas.height = backingHeight
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null
  resizeObserver?.observe(canvas)
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)
  resize()

  function drawHand(hand, debug) {
    const points = hand.points
    if (!points || points.length < 21) return

    ctx.globalAlpha = hand.alpha ?? 1

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = HAND_STYLE.bone
    ctx.lineWidth = HAND_STYLE.boneWidth
    ctx.beginPath()
    for (const [from, to] of HAND_CONNECTIONS) {
      ctx.moveTo(points[from].x, points[from].y)
      ctx.lineTo(points[to].x, points[to].y)
    }
    ctx.stroke()

    ctx.fillStyle = HAND_STYLE.joint
    for (const point of points) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, HAND_STYLE.jointRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.strokeStyle = HAND_STYLE.ring
    ctx.lineWidth = HAND_STYLE.ringWidth
    for (const index of HAND_STYLE.ringTips) {
      const point = points[index]
      ctx.beginPath()
      ctx.arc(point.x, point.y, HAND_STYLE.ringRadius, 0, Math.PI * 2)
      ctx.stroke()
    }

    if (debug) {
      const wrist = points[0]
      ctx.globalAlpha = 1
      ctx.fillStyle = HAND_STYLE.label
      ctx.font = HAND_STYLE.labelFont
      ctx.textBaseline = 'bottom'
      ctx.fillText(hand.label, wrist.x + 10, wrist.y - 10)
    }

    ctx.globalAlpha = 1
  }

  function drawStringBase(string) {
    const tint = stringTint(string)
    const { a, b } = string
    const normal = unitNormal(a, b)
    const length = Math.hypot(b.x - a.x, b.y - a.y)

    // Faint parallel "ruler edge".
    ctx.globalAlpha = STRING_STYLE.guideAlpha
    ctx.strokeStyle = tint.core
    ctx.lineWidth = STRING_STYLE.guideWidth
    ctx.beginPath()
    ctx.moveTo(a.x + normal.x * STRING_STYLE.guideOffset, a.y + normal.y * STRING_STYLE.guideOffset)
    ctx.lineTo(b.x + normal.x * STRING_STYLE.guideOffset, b.y + normal.y * STRING_STYLE.guideOffset)
    ctx.stroke()

    // Soft halo keeps the thin string visible over a busy camera feed.
    ctx.globalAlpha = STRING_STYLE.coreGlowAlpha
    ctx.strokeStyle = tint.glow
    ctx.lineWidth = STRING_STYLE.coreGlowWidth
    ctx.shadowBlur = 12
    ctx.shadowColor = tint.glow
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.shadowBlur = 0

    // Main thread.
    ctx.globalAlpha = STRING_STYLE.baseAlpha
    ctx.strokeStyle = tint.core
    ctx.lineWidth = STRING_STYLE.coreWidth
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()

    // Tick marks, every fifth one taller.
    ctx.globalAlpha = STRING_STYLE.tickAlpha
    ctx.lineWidth = STRING_STYLE.tickWidth
    ctx.beginPath()
    let index = 0
    for (
      let along = STRING_STYLE.tickStep;
      along < length - STRING_STYLE.tickStep / 2;
      along += STRING_STYLE.tickStep
    ) {
      const s = along / length
      const half =
        index % 5 === 0
          ? STRING_STYLE.tickHalfTall
          : STRING_STYLE.tickHalf
      const cx = a.x + (b.x - a.x) * s
      const cy = a.y + (b.y - a.y) * s
      ctx.moveTo(cx - normal.x * half, cy - normal.y * half)
      ctx.lineTo(cx + normal.x * half, cy + normal.y * half)
      index += 1
    }
    ctx.stroke()

    // End caps and endpoint circles.
    ctx.globalAlpha = STRING_STYLE.capAlpha
    ctx.lineWidth = STRING_STYLE.capWidth
    ctx.beginPath()
    for (const end of [a, b]) {
      ctx.moveTo(
        end.x - normal.x * STRING_STYLE.capHalf,
        end.y - normal.y * STRING_STYLE.capHalf,
      )
      ctx.lineTo(
        end.x + normal.x * STRING_STYLE.capHalf,
        end.y + normal.y * STRING_STYLE.capHalf,
      )
    }
    ctx.stroke()

    for (const [point, held] of [
      [a, string.heldA],
      [b, string.heldB],
    ]) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, STRING_STYLE.circleRadius, 0, Math.PI * 2)
      if (held) {
        ctx.globalAlpha = 0.9
        ctx.fillStyle = tint.core
        ctx.shadowBlur = 12
        ctx.shadowColor = tint.glow
        ctx.fill()
        ctx.shadowBlur = 0
      } else {
        ctx.globalAlpha = 0.75
        ctx.strokeStyle = tint.core
        ctx.lineWidth = STRING_STYLE.circleWidth
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  function drawStringWave(string, now) {
    const ring = string.ring
    if (!ring) return
    const age = (now - ring.startedAt) / 1000
    if (age < 0 || age > 1.3) return

    const tint = stringTint(string)
    const { a, b } = string
    const normal = unitNormal(a, b)
    const envelope = Math.exp(-age / (0.28 + ring.intensity * 0.22))
    if (envelope < 0.02) return

    const amplitude = (10 + ring.intensity * 22) * envelope
    const oscillation = Math.sin(2 * Math.PI * 8 * age)
    const k = ring.k || 1
    const points = []

    const segments = 36
    for (let i = 0; i <= segments; i += 1) {
      const s = i / segments
      const cx = a.x + (b.x - a.x) * s
      const cy = a.y + (b.y - a.y) * s
      const displacement =
        amplitude * oscillation * Math.sin(Math.PI * k * s)
      points.push({
        x: cx + normal.x * displacement,
        y: cy + normal.y * displacement,
      })
    }

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Wide soft glow.
    tracePolyline(ctx, points)
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = tint.glow
    ctx.lineWidth = 13
    ctx.shadowBlur = 24
    ctx.shadowColor = tint.glow
    ctx.stroke()

    // Coloured body of the vibrating string.
    tracePolyline(ctx, points)
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = tint.core
    ctx.lineWidth = 6
    ctx.shadowBlur = 14
    ctx.shadowColor = tint.glow
    ctx.stroke()

    // Bright core.
    tracePolyline(ctx, points)
    ctx.globalAlpha = 0.98
    ctx.strokeStyle = '#fffef0'
    ctx.lineWidth = 3.4
    ctx.shadowBlur = 12
    ctx.shadowColor = tint.glow
    ctx.stroke()

    ctx.restore()
  }

  function drawScene({ hands = [], strings = [], particles = null, now = 0, debug = false }) {
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    for (const string of strings) {
      drawStringBase(string)
      drawStringWave(string, now)
    }

    for (const hand of hands) drawHand(hand, debug)

    particles?.draw(ctx)
  }

  function getSize() {
    return { width: cssWidth, height: cssHeight, dpr }
  }

  function clear() {
    ctx.clearRect(0, 0, cssWidth, cssHeight)
  }

  function destroy() {
    resizeObserver?.disconnect()
    window.removeEventListener('resize', resize)
    window.removeEventListener('orientationchange', resize)
  }

  return { drawScene, resize, getSize, clear, destroy }
}
