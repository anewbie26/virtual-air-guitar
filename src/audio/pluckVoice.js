import * as Tone from 'tone'

export const VOICE_POOL_SIZE = 16

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pitch- and velocity-dependent PluckSynth settings. Lower notes are warmer
 * and sustain longer; a harder pluck adds pick noise and brightness. Kept
 * pure so the tone shaping can be tested without Web Audio.
 */
export function pluckTone(frequency, velocity = 0.7) {
  const hz = clamp(frequency, 80, 1200)
  const strength = clamp(velocity, 0.05, 1)
  const pitch = (hz - 80) / (1200 - 80)

  return {
    attackNoise: clamp(0.45 + strength * 0.75, 0.4, 1.3),
    dampening: clamp(1700 + pitch * 1900 + strength * 900, 1500, 5000),
    resonance: clamp(0.95 + strength * 0.03, 0.95, 0.98),
    release: clamp(1.9 + strength * 1.3 - pitch * 0.25, 1.6, 3.2),
  }
}

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
          attackNoise: 0.8,
          dampening: 2800,
          resonance: 0.965,
          release: 2.4,
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
        const tone = pluckTone(frequency, level)
        voice.synth.attackNoise = tone.attackNoise
        voice.synth.dampening = tone.dampening
        voice.synth.resonance = tone.resonance
        voice.synth.release = tone.release
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
