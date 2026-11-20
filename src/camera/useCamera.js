import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const CAMERA_STATUS = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  READY: 'ready',
  ERROR: 'error',
}

const MOBILE_RE = /Android|iPhone|iPad|iPod|Mobile/i

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  if (navigator.userAgentData?.mobile) return true
  if (MOBILE_RE.test(navigator.userAgent)) return true
  // iPadOS 13+ reports as Macintosh but is still a touch camera device.
  return (
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1
  )
}

/**
 * Mobile cameras gain nothing from 1280x720 while hand tracking runs on top,
 * so ask for a smaller frame there. Object-fit cover handles the crop.
 */
function buildConstraints({ deviceId, facingMode, mobile }) {
  const size = mobile
    ? { width: { ideal: 640 }, height: { ideal: 480 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 } }

  return {
    audio: false,
    video: {
      ...size,
      frameRate: { ideal: 30, max: 30 },
      ...(deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: facingMode } }),
    },
  }
}

async function listVideoInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return all.filter((device) => device.kind === 'videoinput')
  } catch {
    return []
  }
}

function inferFacing(label, fallback) {
  if (!label) return fallback
  if (/back|rear|environment/i.test(label)) return 'environment'
  if (/front|user|face/i.test(label)) return 'user'
  return fallback
}

/** Turn a getUserMedia failure into a stable code plus a human message. */
export function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        code: 'permission-denied',
        message:
          'Camera permission was denied. Allow camera access in your browser settings, then try again.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        code: 'not-found',
        message: 'No camera was found on this device.',
      }
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        code: 'in-use',
        message:
          'The camera is busy or unavailable. Close other apps that use it, then try again.',
      }
    case 'OverconstrainedError':
      return {
        code: 'constraints',
        message: 'This camera does not support the requested video settings.',
      }
    case 'SecurityError':
      return {
        code: 'insecure',
        message:
          'Camera access needs a secure connection. Open the site over HTTPS, or use localhost during development.',
      }
    default:
      return {
        code: 'unknown',
        message: err?.message || 'Could not start the camera.',
      }
  }
}

/**
 * Camera lifecycle hook. Owns getUserMedia, device switching and track cleanup.
 * The stream is attached to `videoRef`; no frames touch React state.
 */
export function useCamera({ videoRef }) {
  const [status, setStatus] = useState(CAMERA_STATUS.IDLE)
  const [error, setError] = useState(null)
  const [facingMode, setFacingMode] = useState('user')
  const [devices, setDevices] = useState([])

  const streamRef = useRef(null)
  const requestIdRef = useRef(0)
  const activeDeviceIdRef = useRef(null)
  const mountedRef = useRef(true)

  const mobile = useMemo(isMobileDevice, [])

  const stopStream = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    const video = videoRef?.current
    if (video) {
      video.pause?.()
      video.srcObject = null
    }
  }, [videoRef])

  const stop = useCallback(() => {
    // Invalidate any getUserMedia request that is still in flight.
    requestIdRef.current += 1
    stopStream()
    activeDeviceIdRef.current = null
    if (mountedRef.current) {
      setStatus(CAMERA_STATUS.IDLE)
      setError(null)
    }
  }, [stopStream])

  const start = useCallback(
    async ({ deviceId, facing = facingMode } = {}) => {
      const video = videoRef?.current
      if (!video) return

      if (!window.isSecureContext) {
        setError(describeCameraError({ name: 'SecurityError' }))
        setStatus(CAMERA_STATUS.ERROR)
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError({
          code: 'unsupported',
          message:
            'This browser does not expose camera access. Try a recent Chrome, Edge or Safari.',
        })
        setStatus(CAMERA_STATUS.ERROR)
        return
      }

      const requestId = ++requestIdRef.current
      stopStream()
      setError(null)
      setStatus(CAMERA_STATUS.REQUESTING)

      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          buildConstraints({ deviceId, facingMode: facing, mobile }),
        )

        // A newer request superseded this one while the user was deciding.
        if (requestId !== requestIdRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        video.srcObject = stream
        video.muted = true

        try {
          await video.play()
        } catch (playError) {
          // AbortError simply means the source changed again; anything else
          // still leaves a live stream attached, so do not discard it.
          if (playError?.name !== 'AbortError') {
            // The <video> stays paused until the next user gesture; the
            // stream itself is valid.
          }
        }

        if (requestId !== requestIdRef.current) {
          stopStream()
          return
        }

        const track = stream.getVideoTracks()[0]
        const settings = track?.getSettings?.() ?? {}
        const nextFacing =
          settings.facingMode || inferFacing(track?.label, facing)
        activeDeviceIdRef.current = settings.deviceId ?? null

        if (mountedRef.current) {
          setFacingMode(nextFacing)
          setStatus(CAMERA_STATUS.READY)
        }

        const inputs = await listVideoInputs()
        if (requestId === requestIdRef.current && mountedRef.current) {
          setDevices(inputs)
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        if (mountedRef.current) {
          setError(describeCameraError(err))
          setStatus(CAMERA_STATUS.ERROR)
        }
      }
    },
    [facingMode, mobile, stopStream, videoRef],
  )

  const switchCamera = useCallback(async () => {
    if (status !== CAMERA_STATUS.READY) return

    if (devices.length > 1) {
      const currentIndex = devices.findIndex(
        (device) => device.deviceId === activeDeviceIdRef.current,
      )
      const next = devices[(currentIndex + 1) % devices.length]
      await start({ deviceId: next.deviceId, facing: facingMode })
      return
    }

    await start({ facing: facingMode === 'user' ? 'environment' : 'user' })
  }, [devices, facingMode, start, status])

  // Release the camera when the component unmounts (route change, HMR, etc.).
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      stopStream()
    }
  }, [stopStream])

  // Keep the device list fresh when a camera is plugged in or removed.
  useEffect(() => {
    const media = navigator.mediaDevices
    if (!media?.addEventListener) return undefined
    const refresh = async () => {
      const inputs = await listVideoInputs()
      if (mountedRef.current) setDevices(inputs)
    }
    media.addEventListener('devicechange', refresh)
    return () => media.removeEventListener('devicechange', refresh)
  }, [])

  const isActive =
    status === CAMERA_STATUS.READY || status === CAMERA_STATUS.REQUESTING

  return {
    status,
    error,
    facingMode,
    devices,
    isMirrored: facingMode !== 'environment',
    canSwitch: devices.length > 1 || mobile,
    isActive,
    start,
    stop,
    switchCamera,
  }
}
