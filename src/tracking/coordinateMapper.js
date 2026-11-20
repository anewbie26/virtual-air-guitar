/**
 * Maps MediaPipe normalized video coordinates (0..1) onto the canvas.
 *
 * The <video> is displayed with `object-fit: cover`, so part of the frame is
 * cropped. Front cameras are mirrored with CSS `scaleX(-1)`, which the canvas
 * does not inherit, so the mapping mirrors X when needed.
 *
 * Keeping this in one place means drawing, pinch detection and plucking all
 * agree on where a landmark is.
 */
export function createCoordinateMapper() {
  let videoWidth = 1
  let videoHeight = 1
  let displayWidth = 1
  let displayHeight = 1
  let mirrored = false

  let scale = 1
  let renderedWidth = 1
  let renderedHeight = 1
  let offsetX = 0
  let offsetY = 0

  function update(next) {
    videoWidth = Math.max(1, next.videoWidth || 1)
    videoHeight = Math.max(1, next.videoHeight || 1)
    displayWidth = Math.max(1, next.displayWidth || 1)
    displayHeight = Math.max(1, next.displayHeight || 1)
    mirrored = Boolean(next.mirrored)

    // object-fit: cover -> fill the display, crop the overflow.
    scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight)
    renderedWidth = videoWidth * scale
    renderedHeight = videoHeight * scale
    offsetX = (displayWidth - renderedWidth) / 2
    offsetY = (displayHeight - renderedHeight) / 2
  }

  function mapPoint(point) {
    let x = offsetX + point.x * renderedWidth
    const y = offsetY + point.y * renderedHeight
    if (mirrored) x = displayWidth - x
    return { x, y }
  }

  function mapLandmarks(landmarks) {
    return landmarks.map(mapPoint)
  }

  return {
    update,
    mapPoint,
    mapLandmarks,
    get viewport() {
      return {
        videoWidth,
        videoHeight,
        displayWidth,
        displayHeight,
        mirrored,
        scale,
        renderedWidth,
        renderedHeight,
        offsetX,
        offsetY,
      }
    },
  }
}
