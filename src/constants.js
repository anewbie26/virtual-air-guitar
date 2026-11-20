// Central tuning values for gesture detection, pitch mapping and rendering.
// All distances are normalized to the shorter screen side unless noted.
// Nothing here assumes a fixed screen position, hand size or camera distance.

// --- Pinch ---------------------------------------------------------------
// Ratio = distance(thumbTip 4, indexTip 8) / handSize(0 -> 9).
export const PINCH_ENTER = 0.25
export const PINCH_EXIT = 0.4
export const PINCH_CONFIRM_FRAMES = 2

// --- Settings ------------------------------------------------------------
export const SENSITIVITY_MIN = 0.5
export const SENSITIVITY_MAX = 2

// --- Strings -------------------------------------------------------------
export const MAX_STRINGS = 12
export const GRAB_RADIUS = 0.045
export const ENDPOINT_GRAB_BONUS = 0.025
export const MIN_STRING_LENGTH = 0.02

// --- Pitch ---------------------------------------------------------------
// f = F_REF * (L_REF / L), clamped to [FREQ_MIN, FREQ_MAX].
export const F_REF = 220
export const L_REF = 0.35
export const FREQ_MIN = 80
export const FREQ_MAX = 1200

// --- Pluck ---------------------------------------------------------------
export const PLUCK_TIPS = [4, 8, 12, 16, 20]
export const PLUCK_COOLDOWN_MS = 120
export const PLUCK_MIN_SPEED = 0.25
export const PLUCK_MAX_SPEED = 4.0
export const PLUCK_MIN_INTENSITY = 0.15
// A finger must move this far from a string (normalized shorter side) before
// it can pluck that string again.
export const PLUCK_REARM_DISTANCE = 0.012

// --- Tracking ------------------------------------------------------------
export const MAX_HANDS = 2
export const HAND_LOST_GRACE_MS = 300
export const MIN_HAND_CONFIDENCE = 0.5
export const DEBUG_UPDATE_MS = 250

// Adaptive frame skipping: once inference costs more than this, process at
// most one video frame per MOBILE_DETECT_INTERVAL_MS.
export const SLOW_INFERENCE_MS = 40
export const MOBILE_DETECT_INTERVAL_MS = 66

// One-Euro filter defaults (used by tracking/oneEuro.js). Landmarks are in
// normalized 0..1 units, so beta is much larger than the pixel-space default.
export const SMOOTH_MIN_CUTOFF = 1.0
export const SMOOTH_BETA = 0.7
export const SMOOTH_D_CUTOFF = 1.0

// --- Rendering -----------------------------------------------------------
export const PARTICLE_MAX = 300
export const PLUCK_VISUAL_DECAY_MS = 1000
export const MAX_DPR = 2
