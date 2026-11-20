import {
  DEBUG_UPDATE_MS,
  HAND_LOST_GRACE_MS,
  MIN_HAND_CONFIDENCE,
  MOBILE_DETECT_INTERVAL_MS,
  PLUCK_VISUAL_DECAY_MS,
  SLOW_INFERENCE_MS,
} from '../constants.js'
import { StringController } from '../gestures/stringController.js'
import { createParticles } from '../render/particles.js'
import { createRenderer } from '../render/renderer.js'
import { closeHandLandmarker, createHandLandmarker } from './handLandmarker.js'
import { createCoordinateMapper } from './coordinateMapper.js'
import { createLandmarkFilters } from './oneEuro.js'

const LANDMARK_COUNT = 21

const DEFAULT_SETTINGS = {
  pinchEnter: 0.25,
  pinchExit: 0.4,
  sensitivity: 1,
}

/**
 * Owns the frame loop: camera/sim -> hands -> gestures -> audio -> canvas.
 * Per-frame data never enters React; status, telemetry and settings do.
 */
export function createTrackingRuntime({
  video,
  canvas,
  sim = null,
  audio = null,
  settings = DEFAULT_SETTINGS,
  mirrored = true,
  onStatus,
  onError,
  onDebug,
}) {
  let landmarker = null
  let rafId = 0
  let running = false
  let disposed = false
  let status = 'idle'
  let error = null

  let lastVideoTime = -1
  let lastDetectAt = 0
  let lastDetectNow = 0
  let lastFrameAt = 0
  let lastDebugAt = 0
  let inferenceEma = 0
  let fpsEma = 0

  let debugEnabled = false
  let telemetryEnabled = false
  let isMirrored = mirrored
  let currentSettings = { ...DEFAULT_SETTINGS, ...settings }

  const mapper = createCoordinateMapper()
  const renderer = createRenderer(canvas)
  const particles = createParticles()
  const controller = new StringController({ settings: currentSettings })

  let hands = []
  const filtersByLabel = new Map()
  const lastSeenAt = new Map()

  function setStatus(next) {
    status = next
    if (!disposed) onStatus?.(next)
  }

  function fail(err) {
    error = err
    setStatus('error')
    if (!disposed) onError?.(err)
  }

  function ensureFilters(label) {
    let filters = filtersByLabel.get(label)
    if (!filters) {
      filters = createLandmarkFilters(LANDMARK_COUNT)
      filtersByLabel.set(label, filters)
    }
    return filters
  }

  function processResult(result, now) {
    const detected = []
    const seen = new Set()
    const landmarks = result?.landmarks ?? []

    for (let i = 0; i < landmarks.length; i += 1) {
      const category = result.handedness?.[i]?.[0]
      const label = category?.categoryName
      const score = category?.score ?? 0
      if ((label !== 'Left' && label !== 'Right') || score < MIN_HAND_CONFIDENCE) {
        continue
      }

      seen.add(label)
      lastSeenAt.set(label, now)
      const filters = ensureFilters(label)
      const smooth = landmarks[i].map((point, index) =>
        filters[index].filter(point, now / 1000),
      )

      detected.push({
        label,
        score,
        raw: landmarks[i],
        smooth,
        alpha: 1,
      })
    }

    // Hold a lost hand briefly so grabbed endpoints do not snap away.
    for (const hand of hands) {
      if (seen.has(hand.label)) continue
      const seenAt = lastSeenAt.get(hand.label) ?? 0
      const age = now - seenAt
      if (age <= HAND_LOST_GRACE_MS) {
        detected.push({
          ...hand,
          alpha: Math.max(0, 1 - age / HAND_LOST_GRACE_MS),
        })
      } else {
        filtersByLabel.delete(hand.label)
        lastSeenAt.delete(hand.label)
      }
    }

    hands = detected
  }

  function mapHands(mapPoint) {
    return hands.map((hand) => ({
      ...hand,
      points: hand.smooth.map(mapPoint),
      rawPoints: hand.raw.map(mapPoint),
    }))
  }

  function processDetection(result, now, size) {
    if (lastDetectNow) {
      const delta = now - lastDetectNow
      if (delta > 0) {
        const instant = 1000 / delta
        fpsEma = fpsEma ? fpsEma * 0.9 + instant * 0.1 : instant
      }
    }
    lastDetectNow = now

    processResult(result, now)
    const mapped = mapHands(mapper.mapPoint)
    const outcome = controller.update({
      hands: mapped,
      now,
      width: size.width,
      height: size.height,
    })

    outcome.plucks.forEach((pluck, index) => {
      const string = pluck.string
      string.ring = {
        startedAt: now,
        intensity: pluck.intensity,
        k: string.id % 2 === 0 ? 1 : 2,
      }
      particles.emit(
        pluck.point.x,
        pluck.point.y,
        20 + Math.round(pluck.intensity * 20),
        pluck.intensity,
      )
      audio?.pluck(
        pluck.frequency,
        pluck.intensity,
        index * 0.012,
        string.id,
      )
    })

    for (const string of outcome.resized) {
      const frequency = controller.model.frequencyOf(string)
      string.lastFrequency = frequency
      if (string.ring) audio?.glide?.(string.id, frequency)
    }

    return outcome
  }

  function updateMapper(size) {
    if (sim) {
      mapper.update({
        videoWidth: size.width,
        videoHeight: size.height,
        displayWidth: size.width,
        displayHeight: size.height,
        mirrored: false,
      })
      return
    }
    if (!video || !video.videoWidth) return
    mapper.update({
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      displayWidth: size.width,
      displayHeight: size.height,
      mirrored: isMirrored,
    })
  }

  function frame(now) {
    if (!running || disposed) return
    rafId = requestAnimationFrame(frame)

    const size = renderer.getSize()
    updateMapper(size)

    if (sim) {
      const result = sim.sample(now, size)
      if (result) processDetection(result, now, size)
    } else if (video && video.readyState >= 2 && video.videoWidth) {
      const isNewFrame = video.currentTime !== lastVideoTime
      const throttled =
        inferenceEma > SLOW_INFERENCE_MS &&
        now - lastDetectAt < MOBILE_DETECT_INTERVAL_MS

      if (landmarker && isNewFrame && !throttled) {
        lastVideoTime = video.currentTime
        lastDetectAt = now
        const startedAt = performance.now()
        try {
          const result = landmarker.detectForVideo(video, now)
          const elapsed = performance.now() - startedAt
          inferenceEma = inferenceEma
            ? inferenceEma * 0.8 + elapsed * 0.2
            : elapsed
          processDetection(result, now, size)
        } catch (err) {
          if (import.meta.env?.DEV) {
            console.warn('[tracking] detectForVideo failed', err)
          }
        }
      }
    }

    const dt = lastFrameAt
      ? Math.min(0.1, (now - lastFrameAt) / 1000)
      : 0
    lastFrameAt = now

    particles.update(dt)
    for (const string of controller.model.strings) {
      if (
        string.ring &&
        now - string.ring.startedAt > PLUCK_VISUAL_DECAY_MS * 1.3
      ) {
        string.ring = null
      }
    }

    const renderHands = mapHands(mapper.mapPoint)
    renderer.drawScene({
      hands: renderHands,
      strings: controller.model.strings,
      particles,
      now,
      debug: debugEnabled,
    })

    if (debugEnabled || telemetryEnabled) {
      if (now - lastDebugAt >= DEBUG_UPDATE_MS) {
        lastDebugAt = now
        onDebug?.({
          status,
          fps: fpsEma,
          inferenceMs: inferenceEma,
          hands: controller.pinchStates,
          handCount: renderHands.length,
          stringCount: controller.model.strings.length,
          frequencies: controller.model.strings.map((string) =>
            controller.model.frequencyOf(string),
          ),
          now,
        })
      }
    }
  }

  async function start() {
    if (running || disposed) return
    running = true

    if (sim) {
      setStatus('running')
      rafId = requestAnimationFrame(frame)
      return
    }

    setStatus('loading')
    try {
      const instance = await createHandLandmarker()
      if (!running || disposed) {
        closeHandLandmarker(instance)
        return
      }
      landmarker = instance
      setStatus('running')
      rafId = requestAnimationFrame(frame)
    } catch (err) {
      running = false
      fail(err)
    }
  }

  function stop() {
    running = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    if (!disposed) setStatus('idle')
  }

  function setMirrored(next) {
    isMirrored = Boolean(next)
  }

  function setDebug(next) {
    debugEnabled = Boolean(next)
  }

  function setTelemetry(next) {
    telemetryEnabled = Boolean(next)
  }

  function setSettings(next) {
    currentSettings = { ...currentSettings, ...next }
    controller.setSettings(currentSettings)
  }

  function clearStrings() {
    controller.clear()
    particles.clear()
  }

  function getSnapshot() {
    return {
      status,
      inferenceMs: inferenceEma,
      hands: controller.pinchStates,
      stringCount: controller.model.strings.length,
    }
  }

  function dispose() {
    disposed = true
    running = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    renderer.clear()
    renderer.destroy()
    closeHandLandmarker(landmarker)
    landmarker = null
    sim?.destroy?.()
    particles.clear()
    controller.clear()
    hands = []
    filtersByLabel.clear()
    lastSeenAt.clear()
  }

  return {
    start,
    stop,
    dispose,
    setMirrored,
    setDebug,
    setTelemetry,
    setSettings,
    clearStrings,
    getSnapshot,
    getStatus: () => status,
    getSettings: () => currentSettings,
  }
}
