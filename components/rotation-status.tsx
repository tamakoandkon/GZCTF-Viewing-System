"use client"

import { useEffect, useState } from "react"

interface RotationStatusProps {
  isRotating: boolean
  currentGroup: number
  totalGroups: number
  rotationInterval: number // in milliseconds
}

export function RotationStatus({ isRotating, currentGroup, totalGroups, rotationInterval }: RotationStatusProps) {
  const [timeLeft, setTimeLeft] = useState(rotationInterval / 1000)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isRotating || totalGroups <= 1) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, rotationInterval - (elapsed % rotationInterval))
      const progressPercent = ((rotationInterval - remaining) / rotationInterval) * 100

      setTimeLeft(Math.ceil(remaining / 1000))
      setProgress(progressPercent)
    }, 100)

    return () => clearInterval(interval)
  }, [isRotating, currentGroup, rotationInterval, totalGroups])

  if (!isRotating || totalGroups <= 1) return null

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 glass-panel px-4 py-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted">
          GROUP {currentGroup + 1}/{totalGroups}
        </span>
        <div className="w-24 h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-linear"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #67E8F9, #D8B4FE)",
              boxShadow: "0 0 8px #67E8F9",
            }}
          />
        </div>
        <span className="text-muted font-mono w-8 text-right">
          {timeLeft}s
        </span>
      </div>
    </div>
  )
}
