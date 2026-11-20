# Virtual Air Guitar

Browser instrument played with bare hands in front of a webcam or phone camera.
Pinch both hands to create a string, drag its ends to resize it, then touch a
string with any fingertip to pluck it. Shorter strings play higher notes.

The camera feed and all hand tracking stay on the device. There is no backend.

## Run

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
npm run preview   # serve the production build
npm test          # Vitest unit tests
```

Production camera access requires HTTPS (localhost is exempt). The MediaPipe
model and WASM files are bundled under `public/`, so there is no CDN dependency
at runtime. The app is a static site and can be deployed to any static host.

## Controls

- **Enable camera** starts the camera and hand tracking. **Stop** releases the
  camera tracks and animation loop; **Switch camera** toggles front/rear.
- **Tap for sound** is required once by browsers before audio can play (iOS
  Safari in particular). Volume and sound mode are in the bottom toolbar.
- **Sensitivity** changes how easily a pluck is detected and how close a pinch
  must be to grab an endpoint.
- **Calibrate** captures your relaxed and pinched thumb/index ratios and sets
  the hysteresis thresholds. It also has manual threshold sliders.
- **Clear** removes all strings.

Gestures:

1. Pinch both hands (thumb tip + index tip) to create a string between them.
2. Keep pinching and move either hand to resize that end; release leaves it in
   place. A pinch near an existing string grabs it instead of creating a new
   one — grab always wins.
3. With open hands, sweep any fingertip across a string to pluck it. Several
   strings crossed in one sweep strum in crossing order.

## Simulation and debug modes

- `?sim=1` replaces the camera with mouse/touch input:
  - no button: a virtual fingertip follows the cursor and plucks strings;
  - left-drag: pinch for hand A;
  - right-drag or Shift+left-drag: pinch for hand B;
  - touch: short drag plucks; long press pinches hand A, a second finger
    pinches hand B.
  
  With one mouse pointer, pressing both buttons places hand B beside hand A so
  a string can be created. Drag with both held to move the string, release one
  button to resize that end. You do not need a camera or HTTPS to try this.
- `?debug=1` shows FPS, inference time, hand/pinch state, string count and
  frequencies. Both query flags can be combined.

## Architecture

- `src/camera/` — camera stream, permission/error handling and video view.
- `src/tracking/` — MediaPipe wrapper, One-Euro smoothing, coordinate mapping,
  and the requestAnimationFrame runtime that owns all per-frame data.
- `src/gestures/` — pinch hysteresis, string model, geometry and pluck
  detection.
- `src/render/` — canvas overlay, pooled sparks and theme.
- `src/audio/` — Tone.js voice pool (16 reusable voices), pitch/velocity-based
  pluck tone shaping, warm EQ/low-pass, light reverb, a gentle strum compressor
  and master volume. Engine API is
  `pluck(frequency, velocity, offsetSeconds, stringId)`.
- `src/sim/` — mouse/touch input producing MediaPipe-shaped results.
- `src/settings.js` — sanitized settings persisted to localStorage.

React only renders controls and throttled status; landmarks, strings and
particles never enter component state.

## Tests

`npm test` covers pinch hysteresis, geometry/segment intersection, string
creation/resizing/grabbing, pluck cooldown and strum order, pitch mapping,
coordinate mapping, camera error mapping, settings persistence and simulation
input. Build is checked with `npm run build`.

### Needs manual testing by you

These cannot be verified in this environment:

1. Desktop Chrome/Edge with a real webcam: allow camera, tap for sound, pinch
   both hands, create string, resize both ends, strum, switch camera, stop and
   restart. Check for console errors.
2. Phone in landscape on Chrome and iOS Safari over HTTPS: same flow, plus
   front/rear switching and rotation while playing.
3. Subjective checks: tracking latency, whether the pinch thresholds feel
   right (use Calibrate), whether PluckSynth or an oscillator mode sounds best,
   and whether the visual style matches the reference screenshots closely
   enough.

The reference JPEGs are kept in `docs/reference/`; visual fidelity is based on
the written spec, not pixel comparison.
# virtual-air-guitar
