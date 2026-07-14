"use client"

import { useState } from "react"
import type { GameEvent } from "@/types/events"
import { formatTimeAgo } from "@/utils/format-time"
import { Flag, Users, Key, Target } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

interface EventsFeedProps {
  events: GameEvent[]
  onEventClick?: (event: GameEvent) => void
}
type EventCategory = "solve" | "attack" | "defense" | "all"

export function EventsFeed({ events, onEventClick }: EventsFeedProps) {
  const { isDark } = useTheme()
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())

  const getEventIcon = (type: string, values?: string[]) => {
    if (type === "FlagSubmit" && values && values.length > 0) {
      if (values[0] === "Accepted") {
        return <Key className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-blue-500"}`} />
      } else {
        return <Target className={`w-4 h-4 ${isDark ? "text-red-400" : "text-pink-400"}`} />
      }
    }
    return <Flag className={`w-4 h-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
  }

  const getEventCategory = (type: string, values?: string[]): EventCategory => {
    if (type === "FlagSubmit" && values && values[0] === "Accepted") return "solve"
    if (type === "FlagSubmit") return "attack"
    return "defense"
  }

  const getEventStatus = (type: string, values?: string[]) => {
    if (type === "FlagSubmit" && values && values.length > 0) {
      return values[0] === "Accepted" ? "成功解出" : "尝试攻击"
    }
    return "系统操作"
  }

  const getCategoryColor = (category: EventCategory) => {
    if (isDark) {
      const colors = {
        solve: "#67E8F9",
        attack: "#EF4444",
        defense: "#84CC16",
        all: "#D8B4FE",
      }
      return colors[category]
    } else {
      const colors = {
        solve: "#AED581",
        attack: "#F8BBD0",
        defense: "#C8E6C9",
        all: "#CE93D8",
      }
      return colors[category]
    }
  }

  // 始终显示所有事件，不限制数量
  const safeEvents = Array.isArray(events) ? events : []
  const sortedEvents = [...safeEvents].sort((a, b) => b.time - a.time)
  const visibleEvents = sortedEvents.slice(0, 15)

  // 计算最近5分钟的事件活跃度
  const now = Date.now()
  const fiveMinutesAgo = now - 10 * 60 * 1000 // 5分鐘 = 300,000毫秒
  const recentEvents = events.filter(e => e.time >= fiveMinutesAgo)
  const maxRecentEvents = 100 // 假设5分钟内最多50个事件算满活跃度
  const activityRate = Math.min(100, (recentEvents.length / maxRecentEvents) * 100)

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  if (!events || events.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="text-muted mb-4">
          <Flag className="w-12 h-12 mx-auto mb-2 opacity-50" />
          暂无操作记录
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-1.5 lg:space-y-3 overflow-hidden">
      {/* 事件统计 - 主题适配，固定在頂部不被擠壓 */}
      <div className="flex-shrink-0 glass-panel p-2 lg:p-3 neon-border glow-effect" style={{ color: isDark ? "#67E8F9" : "#00BCD4" }}>
        <div className="text-center">
          <div className="text-sm lg:text-base font-bold mb-1 lg:mb-1.5">
            活跃度统计
          </div>
          <div className="text-[10px] lg:text-xs text-muted mb-1 lg:mb-1.5 leading-tight">
            成功解题 {events.filter((e) => getEventCategory(e.type, e.values) === "solve").length} | 
            攻击尝试 {events.filter((e) => getEventCategory(e.type, e.values) === "attack").length} 
          </div>
          <div className="text-[10px] lg:text-xs text-muted mb-1 lg:mb-1.5 leading-tight">
            最近5分钟活跃度: {recentEvents.length} / {maxRecentEvents} 操作
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
          {visibleEvents.map((event, index) => {
            const eventId = `${event.time}-${index}`
            const isExpanded = expandedEvents.has(eventId)
            const category = getEventCategory(event.type, event.values)
            const categoryColor = getCategoryColor(category)

            return (
              <div
                key={eventId}
                className={`glass-panel p-2 cursor-pointer transition-all duration-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-transparent fade-in-up hover-lift ${isExpanded ? "ring-1 ring-white/20" : ""}`}
                style={{
                  animationDelay: `${index * 0.05}s`,
                  borderColor: "rgba(255,255,255,0.05)",
                  boxShadow: "none",
                }}
                onClick={() => {
                  toggleEventExpansion(eventId)
                  onEventClick?.(event)
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 neon-border font-mono"
                    style={{
                      backgroundColor: `${categoryColor}${isDark ? "20" : "30"}`,
                      borderColor: `${categoryColor}${isDark ? "40" : "50"}`,
                    }}
                  >
                    {getEventIcon(event.type, event.values)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted mb-1 font-mono">{formatTimeAgo(event.time)}</div>

                    {event.team && (
                      <div className="flex items-center gap-2 mb-1">
                        <Users className={`w-3 h-3 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                        <span className="text-sm font-medium text-primary truncate">{event.team}</span>
                      </div>
                    )}

                    <div className="text-sm text-secondary">
                      <span style={{ color: categoryColor }}>{getEventStatus(event.type, event.values)}</span>
                      {event.values && event.values.length > 2 && (
                        <span className="ml-2 text-primary font-medium">{event.values[2]}</span>
                      )}
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
