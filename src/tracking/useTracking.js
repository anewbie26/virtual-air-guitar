import { useEffect, useRef, useState } from 'react'
import { createTrackingRuntime } from './trackingRuntime.js'

/**
 * React adapter for the plain tracking runtime. The rAF loop and all landmark
 * data live in the runtime; React only sees status and a throttled snapshot.
 */
export function useTracking({
  videoRef,
  canvasRef,
  sim = null,
  active,
  mirrored = true,
  settings,
  audio = null,
  debug = false,
  telemetry = false,
}) {
  const runtimeRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    if (!active) return undefined

    const video = videoRef?.current ?? null
    const canvas = canvasRef.current
    if (!canvas) return undefined
    if (!sim && !video) return undefined

    const runtime = createTrackingRuntime({
      video,
      canvas,
      sim,
      audio,
      settings,
      mirrored,
      onStatus: setStatus,
      onError: setError,
      onDebug: setSnapshot,
    })

    runtimeRef.current = runtime
    runtime.setDebug(debug)
    runtime.setTelemetry(telemetry)
    runtime.start()

    return () => {
      runtime.dispose()
      if (runtimeRef.current === runtime) runtimeRef.current = null
      setSnapshot(null)
    }
    // settings/debug/telemetry/mirrored are applied by the effects below so a
    // slider change does not reload the model or restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, videoRef, canvasRef, sim])

  useEffect(() => {
    runtimeRef.current?.setMirrored(mirrored)
  }, [mirrored])

  useEffect(() => {
    runtimeRef.current?.setDebug(debug)
  }, [debug])

  useEffect(() => {
    runtimeRef.current?.setTelemetry(telemetry)
  }, [telemetry])

  useEffect(() => {
    if (settings) runtimeRef.current?.setSettings(settings)
  }, [settings])

  return { status, error, snapshot, runtimeRef }
}
