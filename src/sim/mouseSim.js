import { createVirtualHand } from './virtualHand.js'

const DEFAULT_B_OFFSET = 0.34
const MIN_SEPARATION = 0.16
// A touch becomes a pinch only after a deliberate long press; a short drag is
// treated as a free fingertip so phones can pluck in simulation mode too.
const TOUCH_PINCH_MS = 260
const TOUCH_SLOP = 0.025

function clamp01(value) {
  return Math.max(0.01, Math.min(0.99, value))
}

/**
 * Mouse/touch simulation that produces the same shape as a MediaPipe result:
 * `{ landmarks: [21 points...], handedness: [[{ categoryName, score }]] }`.
 *
 * - Left button: pinch hand A (Left).
 * - Right button or Shift+Left: pinch hand B (Right).
 * - No button: a free Right fingertip follows the cursor and can pluck.
 * - Touch: short drag plucks; long press pinches A, a second finger pinches B.
 *
 * With one mouse pointer, pressing both buttons places hand B at an offset so
 * a string can actually be created; dragging then moves both ends together.
 * Release one button to drag the remaining end and resize.
 */
export function createMouseSim({ bOffset = DEFAULT_B_OFFSET } = {}) {
  let element = null
  let windowTarget = null
  let cursor = { x: 0.5, y: 0.5 }
  let a = { active: false, point: { x: 0.3, y: 0.5 }, pointerId: null, button: 0 }
  let b = {
    active: false,
    point: { x: 0.6, y: 0.5 },
    pointerId: null,
    button: 2,
    offset: { x: bOffset, y: 0 },
  }
  const touchCandidates = new Map()
  const listenerOptions = { passive: false }

  function clearCandidate(id) {
    const candidate = touchCandidates.get(id)
    if (candidate?.timer) {
      clearTimeout(candidate.timer)
      candidate.timer = null
    }
    touchCandidates.delete(id)
  }

  function clearAllCandidates() {
    for (const id of [...touchCandidates.keys()]) clearCandidate(id)
  }

  function toPoint(event) {
    const rect = element.getBoundingClientRect()
    return {
      x: clamp01((event.clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01((event.clientY - rect.top) / Math.max(1, rect.height)),
    }
  }

  function handFor(which) {
    return which === 'a' ? a : b
  }

  function activate(which, point, pointerId, button, pointerType) {
    const hand = handFor(which)
    hand.active = true
    hand.point = { ...point }
    hand.pointerId = pointerId
    hand.button = button

    if (which === 'b' && a.active && pointerType === 'mouse') {
      // One physical pointer cannot be in two places. Keep B beside A unless
      // the user already put it somewhere clearly separate.
      const dx = b.point.x - a.point.x
      const dy = b.point.y - a.point.y
      if (Math.hypot(dx, dy) < MIN_SEPARATION) {
        b.offset = { x: bOffset, y: 0 }
        b.point = {
          x: clamp01(a.point.x + b.offset.x),
          y: clamp01(a.point.y + b.offset.y),
        }
      } else {
        b.offset = { x: dx, y: dy }
      }
    }
  }

  function deactivate(which) {
    const hand = handFor(which)
    hand.active = false
    hand.pointerId = null
  }

  function handleDown(event) {
    event.preventDefault()
    element.setPointerCapture?.(event.pointerId)
    const point = toPoint(event)
    cursor = point

    if (event.pointerType !== 'mouse') {
      clearCandidate(event.pointerId)
      const candidate = {
        start: { ...point },
        point: { ...point },
        activated: false,
        cancelled: false,
        timer: null,
      }
      touchCandidates.set(event.pointerId, candidate)

      // A second finger while one hand is already pinching immediately grabs
      // hand B. Touch devices have no right mouse button.
      if ((a.active || b.active) && event.pointerId !== a.pointerId) {
        candidate.activated = true
        if (a.active && !b.active) activate('b', point, event.pointerId, 0, 'touch')
        return
      }

      candidate.timer = setTimeout(() => {
        if (touchCandidates.get(event.pointerId) !== candidate) return
        if (candidate.cancelled || candidate.activated) return
        candidate.activated = true
        if (!a.active) {
          activate('a', candidate.point, event.pointerId, 0, 'touch')
        } else if (!b.active) {
          activate('b', candidate.point, event.pointerId, 0, 'touch')
        }
      }, TOUCH_PINCH_MS)
      return
    }

    const wantsB = event.button === 2 || (event.button === 0 && event.shiftKey)
    if (wantsB) {
      if (!b.active) activate('b', point, event.pointerId, event.button, 'mouse')
    } else if (event.button === 0 && !a.active) {
      activate('a', point, event.pointerId, 0, 'mouse')
    }
  }

  function handleMove(event) {
    if (!element) return
    const point = toPoint(event)

    if (event.pointerType !== 'mouse') {
      // A touch that is not a long press is a plucking fingertip.
      cursor = point
      const candidate = touchCandidates.get(event.pointerId)
      if (candidate && !candidate.activated && !candidate.cancelled) {
        candidate.point = { ...point }
        const moved = Math.hypot(
          point.x - candidate.start.x,
          point.y - candidate.start.y,
        )
        if (moved > TOUCH_SLOP) {
          candidate.cancelled = true
          if (candidate.timer) clearTimeout(candidate.timer)
          candidate.timer = null
        }
      }
    }

    if (!a.active && !b.active) return

    if (a.active && a.pointerId === event.pointerId) {
      a.point = point
    }
    if (b.active && b.pointerId === event.pointerId) {
      if (a.active && event.pointerType === 'mouse') {
        b.point = {
          x: clamp01(a.point.x + b.offset.x),
          y: clamp01(a.point.y + b.offset.y),
        }
      } else {
        b.point = point
      }
    }
  }

  function handleUp(event) {
    const isTouch = event.pointerType !== 'mouse'
    if (isTouch) {
      const candidate = touchCandidates.get(event.pointerId)
      clearCandidate(event.pointerId)
      if (candidate?.activated) {
        if (a.active && a.pointerId === event.pointerId) deactivate('a')
        else if (b.active && b.pointerId === event.pointerId) deactivate('b')
      }
      return
    }

    if (a.active && a.button === event.button) deactivate('a')
    if (b.active && b.button === event.button) deactivate('b')
  }

  function handleBlur() {
    clearAllCandidates()
    deactivate('a')
    deactivate('b')
  }

  function handleContextMenu(event) {
    event.preventDefault()
  }

  function attach(nextElement) {
    detach()
    element = nextElement
    if (!element) return
    element.addEventListener('pointerdown', handleDown, listenerOptions)
    element.addEventListener('pointermove', handleMove, listenerOptions)
    element.addEventListener('pointerup', handleUp, listenerOptions)
    element.addEventListener('pointercancel', handleUp, listenerOptions)
    windowTarget =
      element.ownerDocument?.defaultView ?? globalThis.window ?? null
    windowTarget?.addEventListener('blur', handleBlur)
    element.addEventListener('contextmenu', handleContextMenu)
  }

  function detach() {
    clearAllCandidates()
    if (!element) return
    element.removeEventListener('pointerdown', handleDown, listenerOptions)
    element.removeEventListener('pointermove', handleMove, listenerOptions)
    element.removeEventListener('pointerup', handleUp, listenerOptions)
    element.removeEventListener('pointercancel', handleUp, listenerOptions)
    element.removeEventListener('contextmenu', handleContextMenu)
    windowTarget?.removeEventListener('blur', handleBlur)
    windowTarget = null
    element = null
  }

  function sample() {
    const hands = []
    if (a.active) {
      hands.push(createVirtualHand({ ...a.point, pinching: true, hand: 'Left' }))
    }
    if (b.active) {
      hands.push(createVirtualHand({ ...b.point, pinching: true, hand: 'Right' }))
    }
    if (!a.active && !b.active) {
      // Hovering fingertip: same Right label the pluck detector expects.
      hands.push(
        createVirtualHand({ ...cursor, pinching: false, hand: 'Right' }),
      )
    }

    return {
      landmarks: hands.map((hand) => hand.points),
      handedness: hands.map((hand) => [
        { categoryName: hand.hand, score: 0.99 },
      ]),
    }
  }

  return {
    attach,
    detach,
    sample,
    destroy: detach,
    getState: () => ({ a: a.active, b: b.active, cursor }),
  }
}
