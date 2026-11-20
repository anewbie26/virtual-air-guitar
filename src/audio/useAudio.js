import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createAudioEngine } from './engine.js'

/**
 * React adapter around the plain audio engine. The engine object is created
 * once; pluck/glide identities are stable so the tracking runtime can keep a
 * reference without restarting the loop.
 */
export function useAudio({ mode, volume }) {
  const engineRef = useRef(null)
  const modeRef = useRef(mode)
  const volumeRef = useRef(volume)
  const [state, setState] = useState({
    unlocked: false,
    error: null,
    mode,
    volume,
  })

  modeRef.current = mode
  volumeRef.current = volume

  const ensureEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = createAudioEngine({
        initialMode: modeRef.current,
        initialVolume: volumeRef.current,
        onState: setState,
      })
    }
    return engineRef.current
  }, [])

  const unlock = useCallback(() => ensureEngine().unlock(), [ensureEngine])

  useEffect(() => {
    engineRef.current?.setMode(mode)
  }, [mode])

  useEffect(() => {
    engineRef.current?.setVolume(volume)
  }, [volume])

  useEffect(
    () => () => {
      engineRef.current?.dispose()
      engineRef.current = null
    },
    [],
  )

  // Stable callbacks used by the non-React frame loop.
  const audio = useMemo(
    () => ({
      pluck: (...args) => engineRef.current?.pluck(...args),
      glide: (...args) => engineRef.current?.glide(...args),
    }),
    [],
  )

  return {
    ...state,
    audio,
    unlock,
    setMode: (next) => ensureEngine().setMode(next),
    setVolume: (next) => ensureEngine().setVolume(next),
  }
}
