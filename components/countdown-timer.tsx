"use client"

import { useEffect, useRef, useState } from "react"

interface CountdownTimerProps {
  endTimeUtc: number
  startTimeUtc: number
}

type Phase = "loading" | "upcoming" | "active" | "ended"

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainder = seconds % 60
  const clock = [hours, minutes, remainder].map((value) => value.toString().padStart(2, "0")).join(":")
  return days > 0 ? `${days}天 ${clock}` : clock
}

export function CountdownTimer({ endTimeUtc, startTimeUtc }: CountdownTimerProps) {
  // The first render is deterministic so server and client markup match.
  const [clock, setClock] = useState<{ phase: Phase; remaining: number }>({
    phase: "loading",
    remaining: 0,
  })
  const ceremonyFired = useRef(false)

  useEffect(() => {
    ceremonyFired.current = false

    function tick() {
      const now = Date.now()
      if (now >= endTimeUtc) {
        setClock({ phase: "ended", remaining: 0 })
        if (!ceremonyFired.current) {
          ceremonyFired.current = true
          window.dispatchEvent(new CustomEvent("game:ended"))
        }
      } else if (now >= startTimeUtc) {
        setClock({ phase: "active", remaining: endTimeUtc - now })
      } else {
        setClock({ phase: "upcoming", remaining: startTimeUtc - now })
      }
    }

    const initialTick = window.setTimeout(tick, 0)
    const interval = window.setInterval(tick, 1_000)
    return () => {
      window.clearTimeout(initialTick)
      window.clearInterval(interval)
    }
  }, [endTimeUtc, startTimeUtc])

  const label = clock.phase === "upcoming" ? "距开始" : clock.phase === "loading" ? "倒计时" : "剩余"
  const urgent = clock.phase === "active" && clock.remaining <= 10 * 60_000

  return (
    <div
      role="timer"
      aria-label={clock.phase === "ended" ? "比赛已结束" : clock.phase === "loading" ? "正在加载倒计时" : `${label} ${formatRemaining(clock.remaining)}`}
      className="flex min-h-11 items-center justify-end gap-2 whitespace-nowrap text-sm"
    >
      {clock.phase === "ended" ? (
        <span className="font-semibold text-white">比赛已结束</span>
      ) : (
        <>
          <span className="text-white/75">{label}</span>
          <span className={`font-semibold tabular-nums ${urgent ? "text-orange-300" : "text-white"}`}>
            {clock.phase === "loading" ? "--:--:--" : formatRemaining(clock.remaining)}
          </span>
        </>
      )}
    </div>
  )
}
