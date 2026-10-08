"use client"

import { useEffect, useState } from "react"
import { Flag, Key, Users } from "lucide-react"

import { useTheme } from "@/contexts/theme-context"
import type { PublicSolveEvent } from "@/types/events"
import { formatTimeAgo } from "@/utils/format-time"

interface EventsFeedProps {
  events: PublicSolveEvent[]
  onEventClick?: (event: PublicSolveEvent) => void
}

export function EventsFeed({ events, onEventClick }: EventsFeedProps) {
  const { isDark } = useTheme()
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [currentTime, setCurrentTime] = useState<number | null>(null)

  useEffect(() => {
    const initialTick = window.setTimeout(() => setCurrentTime(Date.now()), 0)
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 15_000)
    return () => {
      window.clearTimeout(initialTick)
      window.clearInterval(timer)
    }
  }, [])

  const sortedEvents = [...events].sort((a, b) => b.time - a.time)
  const visibleEvents = sortedEvents.slice(0, 15)
  const referenceTime = currentTime ?? sortedEvents[0]?.time ?? 0
  const recentEvents = events.filter((event) => event.time >= referenceTime - 5 * 60 * 1_000)
  const maxRecentEvents = 50
  const activityRate = Math.min(100, (recentEvents.length / maxRecentEvents) * 100)
  const solveColor = isDark ? "#67E8F9" : "#00BCD4"

  if (events.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="text-muted mb-4">
          <Flag className="w-12 h-12 mx-auto mb-2 opacity-50" />
          暂无公开解题记录
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-1.5 lg:space-y-3 overflow-hidden">
      <div className="flex-shrink-0 glass-panel p-2 lg:p-3 neon-border glow-effect" style={{ color: solveColor }}>
        <div className="text-center">
          <div className="text-sm lg:text-base font-bold mb-1 lg:mb-1.5">活跃度统计</div>
          <div className="text-[10px] lg:text-xs text-muted mb-1 lg:mb-1.5 leading-tight">
            公开成功解题 {events.length}
          </div>
          <div className="text-[10px] lg:text-xs text-muted mb-1 lg:mb-1.5 leading-tight">
            最近5分钟活跃度: {recentEvents.length} / {maxRecentEvents} 次
          </div>
          <div className="w-full bg-muted/50 rounded-full h-1.5 lg:h-2 overflow-hidden">
            <div
              className="h-1.5 lg:h-2 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${activityRate}%`,
                background: isDark
                  ? "linear-gradient(90deg, #67E8F9, #D8B4FE)"
                  : "linear-gradient(90deg, #81D4FA, #CE93D8)",
                boxShadow: isDark ? "0 0 10px #67E8F9" : "0 0 8px #81D4FA",
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="w-full h-full overflow-y-auto pr-1 lg:pr-2 space-y-1 lg:space-y-2">
          {visibleEvents.map((event) => {
            const eventId = `${event.teamId}-${event.challengeId}-${event.time}`
            const isExpanded = expandedEvents.has(eventId)
            return (
              <div
                key={eventId}
                className={`glass-panel p-2 cursor-pointer transition-all duration-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-transparent fade-in-up hover-lift ${isExpanded ? "ring-1 ring-white/20" : ""}`}
                style={{ borderColor: "rgba(255,255,255,0.05)", boxShadow: "none" }}
                onClick={() => {
                  setExpandedEvents((current) => {
                    const next = new Set(current)
                    if (next.has(eventId)) next.delete(eventId)
                    else next.add(eventId)
                    return next
                  })
                  onEventClick?.(event)
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 neon-border font-mono"
                    style={{ backgroundColor: `${solveColor}20`, borderColor: `${solveColor}40` }}
                  >
                    <Key className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-blue-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted mb-1 font-mono">{formatTimeAgo(event.time)}</div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className={`w-3 h-3 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                      <span className="text-sm font-medium text-primary truncate">{event.team}</span>
                    </div>
                    <div className="text-sm text-secondary">
                      <span style={{ color: solveColor }}>成功解出</span>
                      <span className="ml-2 text-primary font-medium">{event.challengeTitle}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
