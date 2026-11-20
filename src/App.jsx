import { useEffect, useMemo, useRef, useState } from 'react'
import { useAudio } from './audio/useAudio.js'
import CameraView from './camera/CameraView.jsx'
import { useCamera } from './camera/useCamera.js'
import DebugPanel from './render/DebugPanel.jsx'
import { createMouseSim } from './sim/mouseSim.js'
import { useTracking } from './tracking/useTracking.js'
import CalibrationPanel from './ui/CalibrationPanel.jsx'
import InstrumentBar from './ui/InstrumentBar.jsx'
import {
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from './settings.js'
import './App.css'

const params = new URLSearchParams(window.location.search)
const DEBUG = params.get('debug') === '1'
const SIM = params.get('sim') === '1'

export default function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const simLayerRef = useRef(null)

  const [settings, setSettings] = useState(loadSettings)
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const [sim] = useState(() => (SIM ? createMouseSim() : null))

  const camera = useCamera({ videoRef })
  const audio = useAudio({ mode: settings.mode, volume: settings.volume })

  const tracking = useTracking({
    videoRef,
    canvasRef,
    sim,
    // In simulation mode there is no camera stream, but the same runtime runs.
    active: SIM || camera.isActive,
    mirrored: !SIM && camera.isMirrored,
    settings,
    audio: audio.audio,
    debug: DEBUG,
    telemetry: true,
  })

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!sim) return undefined
    sim.attach(simLayerRef.current)
    return () => sim.detach()
  }, [sim])

  const changeSettings = (patch) => {
    setSettings((previous) => sanitizeSettings({ ...previous, ...patch }))
  }

  const clearStrings = () => {
    tracking.runtimeRef.current?.clearStrings()
  }

  // The start button is a real user gesture, so start audio with it. The
  // browser still allows an explicit "Tap for sound" button in the toolbar.
  const startEverything = () => {
    audio.unlock()
    camera.start()
  }

  return (
    <main className="app">
      <CameraView
        videoRef={videoRef}
        status={camera.status}
        error={camera.error}
        facingMode={camera.facingMode}
        isMirrored={camera.isMirrored}
        canSwitch={camera.canSwitch}
        sim={SIM}
        onStart={startEverything}
        onStop={camera.stop}
        onSwitch={camera.switchCamera}
      >
        <canvas ref={canvasRef} className="overlay" aria-hidden="true" />
        {SIM && (
          <div
            ref={simLayerRef}
            className="sim-layer"
            role="application"
            aria-label="Simulation input: drag to play"
          />
        )}
      </CameraView>

      {SIM && (
        <p className="app__sim-hint">
          Mouse: drag to pluck · left-drag = hand A · right-drag / Shift-drag =
          hand B
        </p>
      )}

      {tracking.status === 'loading' && (
        <p className="app__hint">Loading hand tracking…</p>
      )}

      {tracking.error && (
        <p className="app__notice" role="alert">
          Hand tracking unavailable: {tracking.error.message}
        </p>
      )}

      {calibrationOpen && (
        <CalibrationPanel
          settings={settings}
          snapshot={tracking.snapshot}
          onChange={changeSettings}
          onClose={() => setCalibrationOpen(false)}
        />
      )}

      {DEBUG && (
        <DebugPanel
          cameraStatus={camera.status}
          trackingStatus={tracking.status}
          snapshot={tracking.snapshot}
          sim={SIM}
          audio={audio}
        />
      )}

      <InstrumentBar
        settings={settings}
        onChange={changeSettings}
        audio={audio}
        stringCount={tracking.snapshot?.stringCount ?? 0}
        onClear={clearStrings}
        onOpenCalibration={() => setCalibrationOpen((open) => !open)}
        sim={SIM}
      />
    </main>
  )
}
