import { CAMERA_STATUS } from './useCamera'
import './CameraView.css'

const STATUS_TEXT = {
  [CAMERA_STATUS.IDLE]: 'Camera off',
  [CAMERA_STATUS.REQUESTING]: 'Starting camera…',
  [CAMERA_STATUS.READY]: 'Camera live',
  [CAMERA_STATUS.ERROR]: 'Camera error',
}

export default function CameraView({
  videoRef,
  status,
  error,
  facingMode,
  isMirrored,
  canSwitch,
  onStart,
  onStop,
  onSwitch,
  sim = false,
  children,
}) {
  const isReady = status === CAMERA_STATUS.READY
  const isBusy = status === CAMERA_STATUS.REQUESTING
  const showCurtain = !sim && status !== CAMERA_STATUS.READY

  return (
    <section
      className={`camera camera--${status}${sim ? ' camera--sim' : ''}`}
    >
      <video
        ref={videoRef}
        className="camera__video"
        style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
      />

      {/* Tracking overlay (canvas) sits above the video, below the controls. */}
      {children}

      {showCurtain && (
        <div className="camera__curtain">
          {status === CAMERA_STATUS.IDLE && (
            <div className="camera__prompt">
              <h1>Virtual Air Guitar</h1>
              <p>
                Allow camera access to play. The video never leaves your
                device.
              </p>
              <button type="button" className="ui-button ui-button--primary" onClick={onStart}>
                Enable camera
              </button>
            </div>
          )}

          {isBusy && <p className="camera__waiting">Requesting camera…</p>}

          {status === CAMERA_STATUS.ERROR && (
            <div className="camera__prompt" role="alert">
              <h2>Camera unavailable</h2>
              <p>{error?.message}</p>
              <button type="button" className="ui-button ui-button--primary" onClick={onStart}>
                Try again
              </button>
              {error?.code === 'permission-denied' && (
                <p className="camera__hint">
                  Look for the camera icon in your browser&apos;s address bar
                  and set it to “Allow”, then reload.
                </p>
              )}
              {error?.code === 'insecure' && (
                <p className="camera__hint">
                  Use HTTPS in production. On a phone, `localhost` will not
                  reach your computer — use the LAN URL shown by the dev
                  server over HTTPS, or deploy to Vercel.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="camera__hud">
        <span className={`camera__pill camera__pill--${status}`}>
          <span className="camera__dot" aria-hidden="true" />
          {sim
            ? 'Simulation · mouse or touch'
            : isReady
              ? `${STATUS_TEXT[status]} · ${facingMode === 'environment' ? 'Rear' : 'Front'}`
              : STATUS_TEXT[status]}
        </span>

        <div className="camera__buttons">
          {isReady && (
            <>
              {canSwitch && (
                <button type="button" className="ui-button" onClick={onSwitch}>
                  Switch camera
                </button>
              )}
              <button type="button" className="ui-button" onClick={onStop}>
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      <div className="camera__rotate-hint" aria-hidden="true">
        Rotate your phone to landscape
      </div>
    </section>
  )
}
