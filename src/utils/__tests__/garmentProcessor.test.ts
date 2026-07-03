import { describe, it, expect } from 'vitest'

describe('garmentProcessor pure logic', () => {
  it('removeBackground is exported and is a function', async () => {
    const mod = await import('../garmentProcessor')
    expect(typeof mod.removeBackground).toBe('function')
  })

  it('prepareGarmentUpload is exported and is a function', async () => {
    const mod = await import('../garmentProcessor')
    expect(typeof mod.prepareGarmentUpload).toBe('function')
  })

  it('autoCropTransparent is exported and is a function', async () => {
    const mod = await import('../garmentProcessor')
    expect(typeof mod.autoCropTransparent).toBe('function')
  })

  it('compositeImages is exported and is a function', async () => {
    const mod = await import('../garmentProcessor')
    expect(typeof mod.compositeImages).toBe('function')
  })
})
