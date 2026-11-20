import * as Tone from 'tone'

export const VOICE_POOL_SIZE = 16

/**
 * One reusable voice pool. Voices are created once and reused forever; a pluck
 * never allocates AudioNodes. When every voice is busy the least-recently-used
 * voice is stolen, which is what a guitarist expects from a fixed polyphony.
 */
export function createVoiceBank({ output, mode = 'pluck', size = VOICE_POOL_SIZE }) {
  const isPluck = mode === 'pluck'
  const voices = []

  for (let i = 0; i < size; i += 1) {
    const gain = new Tone.Gain(0.8)
    gain.connect(output)

    const synth = isPluck
      ? new Tone.PluckSynth({
          attackNoise: 1.1,
          dampening: 3400,
          resonance: 0.93,
          release: 1.6,
        })
      : new Tone.Synth({
          oscillator: { type: mode },
          envelope: {
            attack: 0.004,
            decay: 0.12,
            sustain: 0.08,
            release: 0.35,
          },
        })

    synth.connect(gain)
    voices.push({
      synth,
      gain,
      lastUsed: -Infinity,
      stringId: null,
    })
  }

  function pickVoice() {
    let oldest = voices[0]
    for (let i = 1; i < voices.length; i += 1) {
      if (voices[i].lastUsed < oldest.lastUsed) oldest = voices[i]
    }
    return oldest
  }

  return {
    mode,

    trigger(frequency, velocity, time, stringId) {
      const voice = pickVoice()
      const level = Math.max(0.05, Math.min(1, velocity))
      voice.lastUsed = time
      voice.stringId = stringId ?? null
      voice.gain.gain.setValueAtTime(0.25 + level * 0.75, time)

      if (isPluck) {
        voice.synth.triggerAttack(frequency, time)
      } else {
        // Short, plucked envelope: enough to hear the pitch without drones.
        voice.synth.triggerAttackRelease(frequency, 0.28, time, level)
      }
      return voice
    },

    /** Only oscillator voices can glide; a plucked comb filter cannot. */
    glide(stringId, frequency, time) {
      if (isPluck) return
      for (const voice of voices) {
        if (voice.stringId !== stringId) continue
        voice.synth.frequency.rampTo(frequency, 0.06, time)
      }
    },

    dispose() {
      for (const voice of voices) {
        try {
          voice.synth.dispose()
          voice.gain.dispose()
        } catch {
          // A partially constructed voice is still safe to drop.
        }
      }
      voices.length = 0
    },
  }
}
