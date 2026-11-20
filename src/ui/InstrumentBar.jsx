import { SENSITIVITY_MAX, SENSITIVITY_MIN } from '../constants.js'
import { SOUND_MODES } from '../audio/engine.js'
import './controls.css'

export default function InstrumentBar({
  settings,
  onChange,
  audio,
  stringCount,
  onClear,
  onOpenCalibration,
  sim = false,
}) {
  return (
    <div className={`instrument-bar${sim ? ' instrument-bar--sim' : ''}`}>
      <button
        type="button"
        className={`ui-button sound-button${
          audio.unlocked ? ' sound-button--on' : ' ui-button--primary'
        }`}
        onClick={() => audio.unlock()}
        aria-pressed={audio.unlocked}
        title={
          audio.unlocked
            ? 'Audio is running'
            : 'Browsers require one tap before audio can start'
        }
      >
        <span className="sound-button__dot" aria-hidden="true" />
        {audio.unlocked ? 'Sound on' : 'Tap for sound'}
      </button>

      <label className="instrument-bar__control">
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.volume}
          onChange={(event) =>
            onChange({ volume: Number(event.target.value) })
          }
          aria-label="Master volume"
        />
        <b>{Math.round(settings.volume * 100)}</b>
      </label>

      <label className="instrument-bar__control">
        <span>Sound</span>
        <select
          value={settings.mode}
          onChange={(event) => onChange({ mode: event.target.value })}
          aria-label="Sound mode"
        >
          {SOUND_MODES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="instrument-bar__control">
        <span>Sensitivity</span>
        <input
          type="range"
          min={SENSITIVITY_MIN}
          max={SENSITIVITY_MAX}
          step="0.05"
          value={settings.sensitivity}
          onChange={(event) =>
            onChange({ sensitivity: Number(event.target.value) })
          }
          aria-label="Pluck sensitivity"
        />
        <b>{settings.sensitivity.toFixed(2)}</b>
      </label>

      <button
        type="button"
        className="ui-button"
        onClick={onOpenCalibration}
        title="Tune pinch thresholds to your hands"
      >
        Calibrate
      </button>

      <button
        type="button"
        className="ui-button"
        onClick={onClear}
        disabled={stringCount === 0}
        title="Remove every string"
      >
        Clear ({stringCount})
      </button>

      {audio.error && (
        <span className="instrument-bar__error" role="alert">
          Audio: {audio.error}
        </span>
      )}
    </div>
  )
}
