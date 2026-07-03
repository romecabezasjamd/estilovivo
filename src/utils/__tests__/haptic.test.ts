import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isHapticEnabled, setHapticEnabled, lightImpact, mediumImpact, heavyImpact, successImpact, errorImpact } from '../haptic'

describe('haptic', () => {
  let vibrateSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vibrateSpy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('isHapticEnabled returns a boolean', () => {
    expect(typeof isHapticEnabled()).toBe('boolean')
  })

  it('setHapticEnabled toggles state', () => {
    const before = isHapticEnabled()
    setHapticEnabled(!before)
    expect(isHapticEnabled()).toBe(!before)
    setHapticEnabled(before)
    expect(isHapticEnabled()).toBe(before)
  })

  it('lightImpact calls vibrate with 10ms', () => {
    setHapticEnabled(true)
    lightImpact()
    expect(vibrateSpy).toHaveBeenCalledWith(10)
  })

  it('mediumImpact calls vibrate with 20ms', () => {
    setHapticEnabled(true)
    mediumImpact()
    expect(vibrateSpy).toHaveBeenCalledWith(20)
  })

  it('heavyImpact calls vibrate with 40ms', () => {
    setHapticEnabled(true)
    heavyImpact()
    expect(vibrateSpy).toHaveBeenCalledWith(40)
  })

  it('successImpact calls vibrate with pattern', () => {
    setHapticEnabled(true)
    successImpact()
    expect(vibrateSpy).toHaveBeenCalledWith([10, 50, 10])
  })

  it('errorImpact calls vibrate with pattern', () => {
    setHapticEnabled(true)
    errorImpact()
    expect(vibrateSpy).toHaveBeenCalledWith([30, 50, 30])
  })

  it('does not vibrate when disabled', () => {
    setHapticEnabled(false)
    vibrateSpy.mockClear()
    lightImpact()
    mediumImpact()
    heavyImpact()
    successImpact()
    errorImpact()
    expect(vibrateSpy).not.toHaveBeenCalled()
  })
})
