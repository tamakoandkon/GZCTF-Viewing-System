"use client"

import { useEffect, useState, useRef } from "react"
import { Clock } from "lucide-react"
import { formatTime } from "@/utils/format-time"
import { useTheme } from "@/contexts/theme-context"

interface CountdownTimerProps {
  endTimeUtc: number
  startTimeUtc: number
  title: string
}

export function CountdownTimer({ endTimeUtc, startTimeUtc, title }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isStarted: false,
    isEnded: false,
    progress: 0,
  })

  // ✅ 修復：初始化為0，避免hydration錯誤
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [isClient, setIsClient] = useState(false)

  const initialMountTime = useRef<number>(0)
  const initialTotalDuration = useRef<number>(0)
  const currentTimeTimer = useRef<NodeJS.Timeout | null>(null)
  const ceremonyFired = useRef<boolean>(false)

  const themeContext = useTheme()
  let isDark = true
  try {
    isDark = themeContext.isDark
  } catch (error) {
    console.warn("Theme context not available, using default dark theme")
  }

  const calculateTimeLeft = () => {
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
      difference = 0
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
      const elapsed = now - startTimeUtc
      progress = Math.min(1, Math.max(0, elapsed / initialTotalDuration.current))
    } else {
      const elapsedWait = now - initialMountTime.current
      progress = Math.min(1, Math.max(0, 1 - elapsedWait / initialTotalDuration.current))
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24))
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((difference % (1000 * 60)) / 1000)

    setTimeLeft({
      days,
      hours,
      minutes,
      seconds,
      isStarted,
      isEnded,
      progress,
    })
  }

  useEffect(() => {
    // ✅ 修復：只在客戶端設置時間
    setIsClient(true)
    initialMountTime.current = Date.now()
    setCurrentTime(Date.now())
    
    calculateTimeLeft()
    const countdownTimer = setInterval(calculateTimeLeft, 1000)

    const updateCurrentTime = () => {
      setCurrentTime(Date.now())
    }
    currentTimeTimer.current = setInterval(updateCurrentTime, 1000)

    return () => {
      clearInterval(countdownTimer)
      if (currentTimeTimer.current) {
        clearInterval(currentTimeTimer.current)
      }
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
        {/* ✅ 修復：只在客戶端顯示時間 */}
        {isClient && (
          <div className="text-xs text-muted mt-1 text-right">{formatTime(currentTime)}</div>
        )}
      </div>
    </div>
  )
}