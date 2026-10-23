import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CountdownTimer } from "@/components/countdown-timer"

afterEach(() => vi.useRealTimers())

describe("CountdownTimer", () => {
  it("shows one compact countdown and fires the end event once", () => {
    vi.useFakeTimers()
    const now = new Date("2026-10-24T00:00:00Z").getTime()
    vi.setSystemTime(now)
    const onEnded = vi.fn()
    window.addEventListener("game:ended", onEnded)

    try {
      render(<CountdownTimer startTimeUtc={now - 60_000} endTimeUtc={now + 3_600_000} />)
      act(() => vi.advanceTimersByTime(0))
      expect(screen.getByRole("timer")).toHaveTextContent("剩余01:00:00")

      act(() => vi.advanceTimersByTime(1_000))
      expect(screen.getByRole("timer")).toHaveTextContent("剩余00:59:59")

      act(() => {
        vi.setSystemTime(now + 3_600_001)
        vi.advanceTimersByTime(1_000)
      })
      expect(screen.getByRole("timer")).toHaveTextContent("比赛已结束")
      act(() => vi.advanceTimersByTime(1_000))
      expect(onEnded).toHaveBeenCalledOnce()
    } finally {
      window.removeEventListener("game:ended", onEnded)
    }
  })
})
