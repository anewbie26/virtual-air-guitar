import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { MAX_HANDS } from '../constants.js'

// Bundled locally (see public/models and public/wasm) so the app has no CDN
// dependency at runtime.
const WASM_PATH = '/wasm'
const MODEL_PATH = '/models/hand_landmarker.task'

function options(delegate) {
  return {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numHands: MAX_HANDS,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  }
}

/**
 * Creates the landmarker, preferring the GPU delegate and falling back to CPU
 * when the device or browser cannot provide it (common on older iOS builds).
 */
export async function createHandLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)

  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'))
  } catch (gpuError) {
    console.warn(
      '[tracking] GPU delegate unavailable, falling back to CPU.',
      gpuError,
    )
    return await HandLandmarker.createFromOptions(fileset, options('CPU'))
  }
}

export function closeHandLandmarker(landmarker) {
  try {
    landmarker?.close?.()
  } catch {
    // Nothing useful to do if the WASM runtime is already torn down.
  }
}
