import { describe, it, expect } from 'vitest'
import { getLoadStatus } from '../poseDetection'

describe('poseDetection', () => {
  it('getLoadStatus returns status object', () => {
    const status = getLoadStatus()
    expect(status).toHaveProperty('isLoading')
    expect(status).toHaveProperty('loadError')
    expect(status).toHaveProperty('hasDetector')
    expect(typeof status.isLoading).toBe('boolean')
    expect(typeof status.hasDetector).toBe('boolean')
  })

  it('getLoadStatus hasDetector is initially false', () => {
    const status = getLoadStatus()
    expect(status.hasDetector).toBe(false)
  })
})
