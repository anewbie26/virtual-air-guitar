/**
 * Standard MediaPipe hand skeleton (21 landmarks). Kept in one place so the
 * renderer and any future debug views agree.
 */
export const HAND_CONNECTIONS = [
  // thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // index
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // middle
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // ring
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // pinky
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // palm
  [0, 17],
]

// Reference style: red joints, bright green bones, white rings on the tips
// used for pinching.
// Very pale tints for idle strings; each entry has a bright core and a glow.
export const STRING_PALETTE = [
  { core: '#fff6c8', glow: 'rgba(215, 255, 130, 0.6)' },
  { core: '#d8fbff', glow: 'rgba(120, 225, 255, 0.6)' },
  { core: '#ffe1f1', glow: 'rgba(255, 140, 215, 0.55)' },
  { core: '#ffffff', glow: 'rgba(205, 225, 255, 0.55)' },
  { core: '#e4ffe0', glow: 'rgba(150, 255, 175, 0.55)' },
  { core: '#eee4ff', glow: 'rgba(190, 150, 255, 0.55)' },
]

export const STRING_STYLE = {
  baseAlpha: 0.68,
  coreWidth: 3,
  coreGlowWidth: 7,
  coreGlowAlpha: 0.18,
  guideOffset: 5,
  guideAlpha: 0.3,
  guideWidth: 1.4,
  tickStep: 20,
  tickHalf: 3.4,
  tickHalfTall: 5.8,
  tickAlpha: 0.5,
  tickWidth: 1.4,
  capHalf: 6,
  capAlpha: 0.75,
  capWidth: 2,
  circleRadius: 5.8,
  circleWidth: 2,
}

export const HAND_STYLE = {
  bone: '#2bff3a',
  boneWidth: 4,
  joint: '#ff2b2b',
  jointRadius: 3.2,
  ring: 'rgba(255, 255, 255, 0.95)',
  ringWidth: 1.5,
  ringRadius: 6.5,
  ringTips: [4, 8],
  label: 'rgba(255, 255, 255, 0.85)',
  labelFont: '12px ui-monospace, SFMono-Regular, Menlo, monospace',
}
