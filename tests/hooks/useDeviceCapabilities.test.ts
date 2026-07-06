import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'

describe('useDeviceCapabilities', () => {
  it('returns default capabilities on desktop', () => {
    const { result } = renderHook(() => useDeviceCapabilities())
    expect(result.current.isMobile).toBe(false)
    expect(result.current.isTablet).toBe(false)
    expect(result.current.pixelRatio).toBeGreaterThanOrEqual(1)
    expect(result.current.maxParticles).toBe(200)
    expect(result.current.enableComplexEffects).toBe(true)
  })

  it('returns renderQuality between 0 and 1', () => {
    const { result } = renderHook(() => useDeviceCapabilities())
    expect(result.current.renderQuality).toBeGreaterThanOrEqual(0.5)
    expect(result.current.renderQuality).toBeLessThanOrEqual(2)
  })

  it('returns maxStars in valid range', () => {
    const { result } = renderHook(() => useDeviceCapabilities())
    expect(result.current.maxStars).toBeGreaterThanOrEqual(100)
    expect(result.current.maxStars).toBeLessThanOrEqual(500)
  })
})
