import * as Tone from 'tone'
import { createVoiceBank } from './pluckVoice.js'

export const SOUND_MODES = [
  { id: 'pluck', label: 'Plucked string' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'sawtooth', label: 'Saw' },
  { id: 'square', label: 'Square' },
]

// PluckSynth cannot lower its frequency after the attack, so oscillator modes
// are used when a held string needs to glide while it is resized.
export const GLIDE_MODES = new Set(['triangle', 'sawtooth', 'square'])

const DEFAULT_STATE = {
  unlocked: false,
  mode: 'pluck',
  volume: 0.8,
  error: null,
}

/**
 * Plain Web Audio/Tone engine. No React. The AudioContext is only started by
 * `unlock()` from a real user gesture (needed on iOS Safari). All voices are
 * allocated once and reused.
 */
export function createAudioEngine({
  initialMode = 'pluck',
  initialVolume = 0.8,
  onState,
} = {}) {
  let state = {
    ...DEFAULT_STATE,
    mode: initialMode,
    volume: initialVolume,
  }
  let disposed = false
  let unlocking = null
  let graph = null
  let bank = null
  let bankMode = null

  function publish(patch) {
    state = { ...state, ...patch }
    onState?.({ ...state })
  }

  function ensureGraph() {
    if (graph) return graph
    const input = new Tone.Gain(1)
    const reverb = new Tone.Reverb({
      decay: 2.4,
      preDelay: 0.012,
      wet: 0.22,
    })
    const master = new Tone.Gain(state.volume)
    input.connect(reverb)
    reverb.connect(master)
    master.toDestination()
    graph = { input, reverb, master }
    return graph
  }

  function voiceBank() {
    if (!graph) ensureGraph()
    if (bank && bankMode === state.mode) return bank
    bank?.dispose()
    bank = createVoiceBank({ output: graph.input, mode: state.mode })
    bankMode = state.mode
    return bank
  }

  async function unlock() {
    if (disposed) return false
    if (state.unlocked) {
      try {
        await Tone.getContext().resume()
      } catch {
        // Already running; nothing else to do.
      }
      return true
    }
    if (unlocking) return unlocking

    unlocking = (async () => {
      try {
        // Must be the first await in the original gesture.
        await Tone.start()
        ensureGraph()
        try {
          await Tone.getContext().resume()
        } catch {
          // Some browsers do not expose resume() on a running context.
        }
        if (disposed) return false
        voiceBank()
        publish({ unlocked: true, error: null })
        return true
      } catch (err) {
        publish({
          unlocked: false,
          error: err instanceof Error ? err.message : String(err),
        })
        return false
      } finally {
        unlocking = null
      }
    })()

    return unlocking
  }

  /**
   * @param {number} frequency Hz
   * @param {number} velocity 0..1
   * @param {number} offsetSeconds strum offset
   * @param {number|string} stringId used by glide()
   */
  function pluck(frequency, velocity = 0.7, offsetSeconds = 0, stringId = null) {
    if (disposed || !state.unlocked || !graph) return
    if (!Number.isFinite(frequency) || frequency <= 0) return
    const time = Tone.now() + Math.max(0, offsetSeconds)
    try {
      voiceBank().trigger(frequency, velocity, time, stringId)
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn('[audio] pluck failed', err)
      }
    }
  }

  function glide(stringId, frequency) {
    if (disposed || !state.unlocked || !graph) return
    if (!GLIDE_MODES.has(state.mode)) return
    if (!Number.isFinite(frequency) || frequency <= 0) return
    try {
      voiceBank().glide(stringId, frequency, Tone.now())
    } catch {
      // A stolen voice may no longer exist; gliding is best effort.
    }
  }

  function setMode(mode) {
    if (!SOUND_MODES.some((option) => option.id === mode)) return
    if (mode === state.mode) return
    publish({ mode })
    if (state.unlocked && graph) {
      try {
        voiceBank()
      } catch (err) {
        if (import.meta.env?.DEV) console.warn('[audio] mode change failed', err)
      }
    }
  }

  function setVolume(volume) {
    const next = Math.max(0, Math.min(1, Number(volume) || 0))
    publish({ volume: next })
    if (graph) {
      graph.master.gain.rampTo(next, 0.05)
    }
  }

  function dispose() {
    if (disposed) return
    disposed = true
    bank?.dispose()
    bank = null
    if (graph) {
      try {
        graph.input.dispose()
        graph.reverb.dispose()
        graph.master.dispose()
      } catch {
        // The Tone context may already be closed.
      }
      graph = null
    }
  }

  return {
    unlock,
    pluck,
    glide,
    setMode,
    setVolume,
    dispose,
    getState: () => ({ ...state }),
  }
}
