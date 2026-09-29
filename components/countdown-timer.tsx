"use client"

import { useEffect, useState, useRef } from "react"
import { Clock } from "lucide-react"
import { formatTime } from "@/utils/format-time"

interface CountdownTimerProps {
  endTimeUtc: number
  startTimeUtc: number
}

export function CountdownTimer({ endTimeUtc, startTimeUtc }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isStarted: false,
    isEnded: false,
    progress: 0,
  })

  // Keep the server and first client render deterministic to avoid hydration drift.
  const [currentTime, setCurrentTime] = useState<number>(0)

  const initialMountTime = useRef<number>(0)
  const initialTotalDuration = useRef<number>(0)
  const ceremonyFired = useRef<boolean>(false)

  useEffect(() => {
    initialMountTime.current = Date.now()
    initialTotalDuration.current = 0
    ceremonyFired.current = false

    const updateTime = () => {
      const now = Date.now()
      const isStarted = now >= startTimeUtc
      const isEnded = now >= endTimeUtc

      if (initialTotalDuration.current === 0) {
        if (isEnded) {
          initialTotalDuration.current = 1
        } else if (isStarted) {
          initialTotalDuration.current = Math.max(1, endTimeUtc - startTimeUtc)
        } else {
          initialTotalDuration.current = Math.max(1, startTimeUtc - initialMountTime.current)
        }
      }

      let difference = 0
      if (isEnded) {
        if (!ceremonyFired.current) {
          ceremonyFired.current = true
          window.dispatchEvent(new CustomEvent('game:ended'))
        }
      } else if (isStarted) {
        difference = endTimeUtc - now
      } else {
        difference = startTimeUtc - now
      }

      let progress = 0
      if (isEnded) {
        progress = 1
      } else if (isStarted) {
        progress = Math.min(1, Math.max(0, (now - startTimeUtc) / initialTotalDuration.current))
      } else {
        progress = Math.min(1, Math.max(0, 1 - (now - initialMountTime.current) / initialTotalDuration.current))
      }

      setCurrentTime(now)
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        isStarted,
        isEnded,
        progress,
      })
    }

    const initialTick = window.setTimeout(updateTime, 0)
    const timer = window.setInterval(updateTime, 1000)

    return () => {
      window.clearTimeout(initialTick)
      window.clearInterval(timer)
    }
  }, [endTimeUtc, startTimeUtc])

  const getProgressColor = () => {
    if (timeLeft.isEnded) return "#EF4444"
    if (timeLeft.progress > 0.8) return "#EF4444"
    if (timeLeft.progress > 0.5) return "#FDE047"
    return "#4ADE80"
  }

  const progressColor = getProgressColor()
  const circleRadius = 25
  const circleCircumference = 2 * Math.PI * circleRadius
  const strokeDashoffset = circleCircumference - timeLeft.progress * circleCircumference

  return (
    <div className="flex items-center gap-3 w-full max-w-[300px]">
      <div className="relative w-[60px] h-[60px] flex items-center justify-center">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle className="stroke-gray-700 stroke-[4] fill-transparent" cx="30" cy="30" r={circleRadius} />
          <circle
            className="stroke-current stroke-[4] fill-transparent stroke-linecap-round transition-all duration-300 ease-in-out"
            cx="30"
            cy="30"
            r={circleRadius}
            stroke={progressColor}
            strokeDasharray={circleCircumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 30 30)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Clock className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {timeLeft.isEnded ? (
          <span className="text-red-400 font-bold text-sm">比賽已結束</span>
        ) : timeLeft.isStarted ? (
          <div className="flex flex-col">
            <span className="text-muted text-xs mb-0.5">剩餘時間</span>
            <div className="flex items-center gap-0.5 text-sm whitespace-nowrap">
              {timeLeft.days > 0 && (
                <>
                  <span className="font-bold text-lg" style={{ color: progressColor }}>
                    {timeLeft.days}
                  </span>
                  <span className="text-muted text-xs">天</span>
                </>
              )}
              <span className="font-bold text-lg w-5 text-right" style={{ color: progressColor }}>
                {timeLeft.hours.toString().padStart(2, "0")}
              </span>
              <span className="text-muted text-xs">:</span>
              <span className="font-bold text-lg w-5 text-right" style={{ color: progressColor }}>
                {timeLeft.minutes.toString().padStart(2, "0")}
              </span>
              <span className="text-muted text-xs">:</span>
              <span className="font-bold text-lg w-5 text-right" style={{ color: progressColor }}>
                {timeLeft.seconds.toString().padStart(2, "0")}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-muted text-xs mb-0.5">開始倒計時</span>
            <div className="flex items-center gap-0.5 text-sm whitespace-nowrap">
              {timeLeft.days > 0 && (
                <>
                  <span className="font-bold text-lg" style={{ color: progressColor }}>
                    {timeLeft.days}
                  </span>
                  <span className="text-muted text-xs">天</span>
                </>
              )}
              <span className="font-bold text-lg w-5 text-right" style={{ color: progressColor }}>
                {timeLeft.hours.toString().padStart(2, "0")}
              </span>
              <span className="text-muted text-xs">:</span>
              <span className="font-bold text-lg w-5 text-right" style={{ color: progressColor }}>
                {timeLeft.minutes.toString().padStart(2, "0")}
              </span>
              <span className="text-muted text-xs">:</span>
              <span className="font-bold text-lg w-5 text-right" style={{ color: progressColor }}>
                {timeLeft.seconds.toString().padStart(2, "0")}
              </span>
            </div>
          </div>
        )}
        {currentTime > 0 && (
          <div className="text-xs text-muted mt-1 text-right">{formatTime(currentTime)}</div>
        )}
      </div>
    </div>
  )
}
