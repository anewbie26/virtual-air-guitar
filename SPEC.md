# Virtual Air Guitar: build spec

How to use: save this as `SPEC.md` in the project root, put the reference screenshots in `docs/reference/`, then send opencode only this:

> Read SPEC.md fully. Look at the images in docs/reference/. Do Phase 1 only, then stop and report using the format in the spec.

---

## 1. What you are building

A browser instrument played with bare hands in front of a webcam or phone camera. No physical guitar, no fixed strings. The user creates strings in the air with pinch gestures, resizes them by dragging their ends, and plays them by touching them with a finger. Pitch depends on string length.

Stack: React + Vite + JavaScript, MediaPipe Tasks Vision (HandLandmarker), Canvas 2D for drawing, Web Audio / Tone.js for sound. No backend, no paid APIs, minimal dependencies. Deploys as a static site (Vercel).

Reference images are in `docs/reference/`. Match them closely (section 3). If you can't view images, say so immediately and ask me for a text description instead of guessing.

## 2. Interaction model (this is the core, get it right)

**Pinch.** A hand is "pinching" when thumb tip (landmark 4) and index tip (landmark 8) are close. Measure the distance as a fraction of hand size (distance from wrist 0 to middle-finger base 9), never in pixels. Use hysteresis: enter pinch below about 0.25, leave above about 0.40, and require 2 consecutive frames to change state. The pinch point is the midpoint of landmarks 4 and 8.

**Create.** When both hands are pinching and neither is grabbing an existing string, a new string appears between the two pinch points. While both hands stay pinched, its two ends follow the hands live. When a hand releases, that end stays where it was dropped. Strings persist until cleared. Cap at 12 strings; provide a Clear button.

**Resize.** Pinching a hand near an existing string (distance to the string segment under a grab radius, or near an endpoint) grabs the nearer endpoint of that string. While held, the endpoint follows the pinch point and the string length changes live. Release to drop it. If a pinch could mean both "create" and "grab", grab wins.

**Pitch from length.** Frequency is inversely proportional to length: `f = F_REF * (L_REF / L)`, with L in normalized screen units (use the shorter screen side), clamped to roughly 80 Hz to 1200 Hz. Longer string = lower, shorter = higher. Put F_REF and L_REF in `constants.js`. Optional setting: snap to a musical scale. If length changes while a note is ringing, glide the pitch.

**Pluck.** Any fingertip (landmarks 4, 8, 12, 16, 20) of a non-pinching hand plucks a string when its movement between the previous frame and this frame crosses the string segment. Use a real segment-segment intersection test on the fingertip path (the fingertip moved from A to B, string goes from P to Q), not a "near the string" check, so fast movements can't tunnel through. Ignore the thumb and index tips of a pinching hand. Pluck intensity comes from fingertip speed (clamped, mapped to gain). Add a per-string, per-finger cooldown (about 120 ms) so one touch doesn't retrigger. Strumming across several strings in one swipe plays each in crossing order.

**Smoothing.** Use a One-Euro filter on landmarks for drawing and pinch detection, but run pluck crossing on lightly smoothed (or raw) positions so there is no added latency.

**Tracking loss.** When a hand disappears for a few frames, don't instantly drop a held endpoint: keep it for about 300 ms, then release it where it was.

## 3. Visual spec (from the reference)

Camera feed is shown full-screen, mirrored (selfie view), not dimmed. Overlays are on a transparent canvas above it.

- **Hands:** all 21 landmarks drawn as red filled dots (about 6 px) joined by bright green lines (about 4 px) using the standard hand connections. Thumb tip and index tip get an extra thin white ring around the red dot.
- **Idle string:** a thin white (or very pale yellow / cyan / pink tint, varied per string) line, 1 to 2 px, with a faint second parallel line a few px away like a ruler edge. Small perpendicular tick marks along the length (taller tick every 5th). Each end has a small perpendicular cap line and a small open circle. The circle takes the string's tint and fills or brightens when held.
- **Strings may be any angle and may extend partly off-screen.** They overlap and cross freely.
- **Plucked string:** the line becomes a glowing wave: bright white-yellow core, yellow-green or cyan glow (use canvas `shadowBlur` or a second wider low-alpha stroke), displaced as a damped standing wave: `y = A * e^(-t/tau) * sin(pi*k*s) * sin(2*pi*f_vis*t)` where s is 0..1 along the string and k is 1 or 2. Visual decay about 0.8 to 1.2 s. Amplitude scales with pluck intensity.
- **Sparks:** on pluck, emit 20 to 40 short white dashes from the crossing point. They scatter outward, drift down slightly, and fade in about 0.6 s. Cap total live particles (about 300) and pool them.
- Keep the UI minimal: start/stop camera, switch camera, volume, sound mode, clear strings, sensitivity. Everything else stays out of the way.

## 4. Audio

The audio engine is plain modules with no React inside.

- Start the audio context only after an explicit user tap. Handle iOS Safari's restrictions.
- Primary sound: a plucked-string synth. Start with Tone.js `PluckSynth` through a pool of about 16 reusable voices (never create nodes per pluck), with a light reverb. Pitch is continuous, so samples are a poor fit. If PluckSynth sounds poor, replace it later with a Karplus-Strong AudioWorklet. Make that swap easy: keep the engine API at `pluck(frequency, velocity)`.
- Optional second mode: a plain oscillator synth (triangle / saw / square).
- Voice stealing when the pool is exhausted. Master volume control.

## 5. Architecture

```
src/
  camera/         useCamera.js
  tracking/       handLandmarker.js, oneEuro.js, coordinateMapper.js
  gestures/       pinch.js, stringModel.js, pluck.js, geometry.js
  render/         renderer.js, particles.js, theme.js
  audio/          engine.js, pluckVoice.js
  sim/            mouseSim.js   (see section 7)
  constants.js
  App.jsx
```

- The frame loop (requestAnimationFrame) lives outside React. Tracking data, strings and particles live in plain objects/refs. React only renders controls and status.
- Map coordinates carefully: MediaPipe gives normalized video coordinates, the video is displayed with `object-fit: cover` and mirrored, and the canvas must match. Write `coordinateMapper.js` once, unit test it, and use it everywhere. Handle resize and rotation.
- HandLandmarker: `numHands: 2`, `runningMode: "VIDEO"`, GPU delegate with CPU fallback. Bundle the `.wasm` files and `hand_landmarker.task` locally under `public/` so the app doesn't depend on a CDN. If you can't download the model file, stop and tell me where to put it.
- Only call detectForVideo when the video has a new frame. On mobile, request a lower camera resolution (about 640x480) and skip frames if the frame time is too high.
- Handle camera permission denied, no camera, init failure, stop/restart (release all tracks), front/rear switching. Camera needs HTTPS in production (localhost is fine for dev). Use `playsinline` for iOS.
- Responsive layout, designed for landscape, with a rotate hint in portrait. Prevent page scroll and pinch-zoom while playing.

## 6. Phases (stop after each)

1. Setup: Vite + React project, deps, folders, dev server runs.
2. Camera: feed, permissions, start/stop, switching, errors.
3. Tracking: both hands, 21 landmarks drawn in the reference style, correct mirroring and left/right.
4. Strings: pinch state machine, create / grab / resize, drawing in the reference style. No sound yet.
5. Pluck + audio: segment crossing, intensity, cooldown, pluck synth, pitch from length, wobble and sparks.
6. Polish: sensitivity settings, calibration of pinch/pluck thresholds, mobile pass, performance pass, cleanup of camera/audio/animation loops.

After each phase report exactly: what was implemented, files changed, what you tested and how, what works, what is incomplete or uncertain. Do not start the next phase until I say so.

## 7. Testing (be honest about what you can and cannot test)

You cannot test real hand tracking, iOS Safari, or how the instrument feels. Do not claim you did. Instead:

- Write unit tests (Vitest) for: segment intersection, pinch hysteresis with synthetic landmark sequences, pitch-from-length mapping, coordinate mapper (mirror, cover, rotation), cooldown logic.
- Build a **simulation input mode** (`?sim=1`): the mouse or touch drives two virtual pinch points and a virtual fingertip, producing the same data shape as real tracking. Use it to verify string creation, resizing, plucking, sound and visuals without a camera. Left-click-hold = pinch for hand A, right-click-hold or a modifier key = hand B, and moving with no button = plucking fingertip.
- Optional: record landmark frames to JSON and add a replay mode.
- For anything that needs a real camera or device, list it under "Needs manual testing by me" in your report, with exact steps.

## 8. Rules

- Inspect the existing project before changing it. Don't replace config files without a reason.
- No placeholder or fake implementations. Don't say a feature works unless you ran it.
- No hardcoded screen coordinates or hand sizes. All thresholds live in `constants.js` and can be tuned from a debug panel (`?debug=1`) showing pinch distances, FPS and detected state.
- Keep dependencies minimal, code modular, and comment the pinch and pluck logic.
- If something in this spec is impossible or unclear, say so and propose an alternative instead of silently changing the design.
- Playability over decoration: if visuals hurt frame rate, cut visuals.

## 9. Done means

Open the site, allow the camera, pinch both hands to create a string, drag its ends to resize it, touch it with a finger to hear a pitch that depends on its length, with the visuals in the reference. Works on desktop Chrome and on a phone in landscape. No console errors. Camera, audio and animation loops are cleaned up.