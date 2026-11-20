import './DebugPanel.css'

export default function DebugPanel({
  cameraStatus,
  trackingStatus,
  snapshot,
  sim = false,
  audio,
}) {
  const hands = snapshot?.hands ?? []

  return (
    <aside className="debug" aria-hidden="true">
      <div className="debug__row">
        <span>mode</span>
        <b>{sim ? 'simulation' : 'camera'}</b>
      </div>
      <div className="debug__row">
        <span>camera</span>
        <b>{cameraStatus}</b>
      </div>
      <div className="debug__row">
        <span>tracking</span>
        <b>{trackingStatus}</b>
      </div>
      <div className="debug__row">
        <span>track fps</span>
        <b>{snapshot ? snapshot.fps.toFixed(1) : '—'}</b>
      </div>
      <div className="debug__row">
        <span>inference</span>
        <b>{snapshot ? `${snapshot.inferenceMs.toFixed(1)} ms` : '—'}</b>
      </div>
      <div className="debug__row">
        <span>strings</span>
        <b>{snapshot?.stringCount ?? 0} / 12</b>
      </div>
      <div className="debug__row">
        <span>audio</span>
        <b>
          {audio?.unlocked ? `${Math.round(audio.volume * 100)}%` : 'locked'}
        </b>
      </div>
      <div className="debug__row">
        <span>hands</span>
        <b>{snapshot?.handCount ?? hands.length}</b>
      </div>
      {hands.map((hand, index) => (
        <div className="debug__hand" key={`${hand.label}-${index}`}>
          {hand.label} · pinch {hand.pinching ? 'closed' : 'open'} ·{' '}
          {hand.ratio === null || hand.ratio === undefined
            ? '—'
            : hand.ratio.toFixed(3)}
        </div>
      ))}
      {snapshot?.frequencies?.length > 0 && (
        <div className="debug__hand">
          hz: {snapshot.frequencies.map((value) => Math.round(value)).join(' · ')}
        </div>
      )}
      <div className="debug__hint">?debug=1</div>
    </aside>
  )
}
