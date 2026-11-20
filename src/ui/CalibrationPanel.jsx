import { useMemo, useState } from 'react'
import { DEFAULT_SETTINGS } from '../settings.js'
import './controls.css'

function average(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value) {
  return Math.round(value * 1000) / 1000
}

export default function CalibrationPanel({
  settings,
  snapshot,
  onChange,
  onClose,
}) {
  const [openRatio, setOpenRatio] = useState(null)
  const [closedRatio, setClosedRatio] = useState(null)
  const [message, setMessage] = useState('')

  const liveRatios = useMemo(
    () =>
      (snapshot?.hands ?? [])
        .filter((hand) => Number.isFinite(hand.ratio))
        .map((hand) => hand.ratio),
    [snapshot],
  )
  const live = average(liveRatios)

  function captureOpen() {
    if (live === null) return
    setOpenRatio(live)
    setMessage('Relaxed hand captured. Now pinch and capture again.')
  }

  function captureClosed() {
    if (live === null) return
    setClosedRatio(live)
    setMessage('Pinch captured. Apply the calibration.')
  }

  function apply() {
    if (openRatio === null || closedRatio === null) {
      setMessage('Capture both a relaxed and a pinched hand first.')
      return
    }
    const gap = openRatio - closedRatio
    if (gap < 0.08) {
      setMessage('Open and pinched are too close together. Try again.')
      return
    }
    const enter = round(closedRatio + gap * 0.35)
    const exit = round(closedRatio + gap * 0.65)
    onChange({ pinchEnter: enter, pinchExit: exit })
    setMessage(
      `Applied: enter < ${enter.toFixed(2)}, exit > ${exit.toFixed(2)}.`,
    )
  }

  return (
    <aside className="calibration" aria-label="Pinch calibration">
      <header className="calibration__header">
        <h2>Pinch calibration</h2>
        <button
          type="button"
          className="ui-button"
          onClick={onClose}
          aria-label="Close calibration"
        >
          Close
        </button>
      </header>

      <p className="calibration__live">
        Live ratio{' '}
        <b>{live === null ? 'no hand' : live.toFixed(3)}</b>
        {liveRatios.length > 1 ? ` (${liveRatios.length} hands)` : ''}
      </p>

      <ol className="calibration__steps">
        <li>
          Hold your hand relaxed, then{' '}
          <button
            type="button"
            className="ui-button"
            onClick={captureOpen}
            disabled={live === null}
          >
            capture open
          </button>
          <b>{openRatio === null ? '—' : openRatio.toFixed(3)}</b>
        </li>
        <li>
          Pinch thumb and index, then{' '}
          <button
            type="button"
            className="ui-button"
            onClick={captureClosed}
            disabled={live === null}
          >
            capture pinch
          </button>
          <b>{closedRatio === null ? '—' : closedRatio.toFixed(3)}</b>
        </li>
      </ol>

      <div className="calibration__manual">
        <label>
          <span>Enter</span>
          <input
            type="range"
            min="0.08"
            max="0.5"
            step="0.01"
            value={settings.pinchEnter}
            onChange={(event) =>
              onChange({ pinchEnter: Number(event.target.value) })
            }
          />
          <b>{settings.pinchEnter.toFixed(2)}</b>
        </label>
        <label>
          <span>Exit</span>
          <input
            type="range"
            min="0.15"
            max="0.9"
            step="0.01"
            value={settings.pinchExit}
            onChange={(event) =>
              onChange({ pinchExit: Number(event.target.value) })
            }
          />
          <b>{settings.pinchExit.toFixed(2)}</b>
        </label>
      </div>

      <div className="calibration__actions">
        <button type="button" className="ui-button ui-button--primary" onClick={apply}>
          Apply
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => {
            onChange({
              pinchEnter: DEFAULT_SETTINGS.pinchEnter,
              pinchExit: DEFAULT_SETTINGS.pinchExit,
            })
            setOpenRatio(null)
            setClosedRatio(null)
            setMessage('Defaults restored.')
          }}
        >
          Reset
        </button>
      </div>

      {message && <p className="calibration__message">{message}</p>}
    </aside>
  )
}
