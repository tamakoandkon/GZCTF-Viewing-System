"use client"

import { useState, useEffect } from "react"

export interface DeviceCapabilities {
  isMobile: boolean
  isTablet: boolean
  pixelRatio: number
  maxParticles: number
  renderQuality: number
  maxStars: number
  enableComplexEffects: boolean
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities>({
    isMobile: false,
    isTablet: false,
    pixelRatio: 1,
    maxParticles: 150,
    renderQuality: 1,
    maxStars: 250,
    enableComplexEffects: true,
  })

  useEffect(() => {
    const detectDeviceCapabilities = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const isTablet = /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent)
      const pixelRatio = Math.min(window.devicePixelRatio, 2)
      setDeviceCapabilities({
        isMobile,
        isTablet,
        pixelRatio,
        maxParticles: isMobile ? 100 : 200,
        renderQuality: isMobile ? 0.8 : 1,
        maxStars: isMobile ? 150 : 300,
        enableComplexEffects: !isMobile,
      })
    }
    detectDeviceCapabilities()
  }, [])

  return deviceCapabilities
}
