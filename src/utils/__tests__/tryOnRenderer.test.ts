import { describe, it, expect } from 'vitest'
import { calculateGarmentTransform } from '../tryOnRenderer'
import { BodyDimensions } from '../bodyDetection'

const defaultDims: BodyDimensions = {
  shoulderWidth: 200, hipWidth: 180, waistWidth: 160,
  torsoHeight: 220, legLength: 260,
  bodyCenterX: 300, bodyCenterY: 350, waistY: 380,
  torsoAngle: 0, headHeight: 50, imageWidth: 600, imageHeight: 800,
}

describe('calculateGarmentTransform', () => {
  it('returns correct transform for top garments', () => {
    const t = calculateGarmentTransform(defaultDims, 'top')
    expect(t.x).toBe(defaultDims.bodyCenterX)
    expect(t.scaleX).toBeCloseTo((200 * 1.18) / 200, 2)
    expect(t.scaleY).toBeCloseTo((220 * 1.18) / 200, 2)
  })

  it('returns correct transform for bottom garments', () => {
    const t = calculateGarmentTransform(defaultDims, 'pants')
    expect(t.scaleX).toBeCloseTo(Math.max(180, 160) * 1.15 / 200, 2)
    expect(t.scaleY).toBeGreaterThan(0)
  })

  it('returns correct transform for dress', () => {
    const t = calculateGarmentTransform(defaultDims, 'dress')
    expect(t.scaleX).toBeCloseTo(Math.max(200, 180) * 1.2 / 200, 2)
    expect(t.scaleY).toBeCloseTo((220 + 260 * 0.85) / 200, 2)
  })

  it('returns correct transform for outerwear', () => {
    const t = calculateGarmentTransform(defaultDims, 'jacket')
    expect(t.scaleX).toBeCloseTo((200 * 1.25) / 200, 2)
    expect(t.scaleY).toBeCloseTo((220 * 1.3) / 200, 2)
  })

  it('returns correct transform for shoes', () => {
    const t = calculateGarmentTransform(defaultDims, 'shoes')
    expect(t.y).toBe(defaultDims.imageHeight - 50)
    expect(t.rotation).toBe(0)
  })

  it('returns correct transform for accessories', () => {
    const t = calculateGarmentTransform(defaultDims, 'bag')
    expect(t.x).toBeGreaterThan(defaultDims.bodyCenterX)
    expect(t.scaleX).toBeCloseTo((200 * 0.42) / 200, 2)
  })

  it('handles unknown garment type with fallback', () => {
    const t = calculateGarmentTransform(defaultDims, 'unknown')
    expect(t.scaleX).toBeCloseTo((200 * 1.2) / 200, 2)
    expect(t.scaleY).toBeCloseTo((220 * 1.0) / 200, 2)
  })

  it('applies torso angle rotation', () => {
    const angled = { ...defaultDims, torsoAngle: 15 }
    const straight = calculateGarmentTransform(defaultDims, 'top')
    const rotated = calculateGarmentTransform(angled, 'top')
    expect(rotated.rotation).not.toBe(straight.rotation)
  })

  it('handles different body proportions', () => {
    const wide = { ...defaultDims, shoulderWidth: 300, hipWidth: 280 }
    const t = calculateGarmentTransform(wide, 'top')
    expect(t.scaleX).toBeCloseTo((300 * 1.18) / 200, 2)
  })
})
