import { describe, expect, it } from 'vitest'
import { describeCameraError } from '../src/camera/useCamera.js'

describe('describeCameraError', () => {
  it('maps permission denial to a stable code and helpful message', () => {
    const result = describeCameraError({ name: 'NotAllowedError' })
    expect(result.code).toBe('permission-denied')
    expect(result.message).toMatch(/permission/i)
  })

  it('maps a missing camera', () => {
    expect(describeCameraError({ name: 'NotFoundError' }).code).toBe('not-found')
  })

  it('maps a camera that another app is using', () => {
    expect(describeCameraError({ name: 'NotReadableError' }).code).toBe('in-use')
  })

  it('maps unsupported constraints', () => {
    expect(describeCameraError({ name: 'OverconstrainedError' }).code).toBe(
      'constraints',
    )
  })

  it('maps insecure contexts', () => {
    expect(describeCameraError({ name: 'SecurityError' }).code).toBe('insecure')
  })

  it('falls back to the original message for unknown failures', () => {
    const result = describeCameraError(new Error('boom'))
    expect(result.code).toBe('unknown')
    expect(result.message).toBe('boom')
  })
})
