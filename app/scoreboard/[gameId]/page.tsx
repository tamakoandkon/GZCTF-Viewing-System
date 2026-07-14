"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getScoreboard, getEvents, getGameDetail, getGameDetails } from "@/services/api"
import { isAuthenticated } from "@/services/auth-service"
import type { ScoreboardResponse } from "@/types/scoreboard"
import type { EventsResponse } from "@/types/events"
import type { GameDetail } from "@/types/game"
import type { GameDetails } from "@/types/challenge"
import { TeamRankings } from "@/components/team-rankings"
import { EventsFeed } from "@/components/events-feed"
import { TopTeamsAbility } from "@/components/top-teams-ability"
import { CountdownTimer } from "@/components/countdown-timer"
import { InteractiveArena } from "@/components/interactive-arena"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RotationStatus } from "@/components/rotation-status"
import { SettingsPanel } from "@/components/settings-panel"
import { CompetitionTitle } from "@/components/competition-title"

export default function ScoreboardPage() {
  const { gameId } = useParams() as { gameId: string }
  const router = useRouter()
  const [scoreboard, setScoreboard] = useState<ScoreboardResponse | null>(null)
  const [events, setEvents] = useState<EventsResponse>([])
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null)
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasData = useRef(false)
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [rotationInterval, setRotationInterval] = useState<NodeJS.Timeout | null>(null)
  const [isRotating, setIsRotating] = useState(true)
  const [totalGroups, setTotalGroups] = useState(0)
  const [isGUIVisible, setIsGUIVisible] = useState(false)

  // 认证检查
  useEffect(() => {
    if (!isAuthenticated()) {
      // 未登录，跳转到登录页面
      router.push('/login')
      return
    }
    
    // 监听认证失败事件
    const handleUnauthorized = () => {
      router.push('/login')
    }
    
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [router])

  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated()) return

      try {
        setError(null)
        const [scoreboardData, eventsData, gameDetailData, gameDetailsData] = await Promise.all([
          getScoreboard(gameId),
          getEvents(gameId),
          getGameDetail(gameId),
          getGameDetails(gameId),
        ])
        setScoreboard(scoreboardData)
        setEvents(eventsData)
        setGameDetail(gameDetailData)
        setGameDetails(gameDetailsData)
        hasData.current = true
        setError(null)
      } catch (err) {
        console.error("Failed to fetch data:", err)
        if (hasData.current) {
          setError("后端暂不可用，已显示缓存数据")
        } else {
          setError("系统连接失败，请稍后重试")
        }
      } finally {
        setLoading(false)
      }
    }

    if (gameId) {
      fetchData()
      const intervalId = setInterval(fetchData, 15000)
      return () => clearInterval(intervalId)
    }
  }, [gameId])

  // Dynamic ranking rotation system
  useEffect(() => {
    if (!scoreboard?.items || scoreboard.items.length === 0) return

    // Calculate total groups (10 teams per group)
    const teamsPerGroup = 10
    const calculatedTotalGroups = Math.ceil(scoreboard.items.length / teamsPerGroup)
    setTotalGroups(calculatedTotalGroups)

    // Only rotate if there are multiple groups
    if (calculatedTotalGroups <= 1) {
      setIsRotating(false)
      setCurrentGroupIndex(0)
      return
    }

    setIsRotating(true)

    // Clear existing interval
    if (rotationInterval) {
      clearInterval(rotationInterval)
    }

    // Set up rotation interval (15 seconds per group)
    const interval = setInterval(() => {
      setCurrentGroupIndex((prev) => (prev + 1) % calculatedTotalGroups)
    }, 15000)

    setRotationInterval(interval)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [scoreboard?.items])

  // Cleanup rotation interval on unmount
  useEffect(() => {
    return () => {
      if (rotationInterval) {
        clearInterval(rotationInterval)
      }
    }
  }, [rotationInterval])

  // Get teams for current group
  const teamsWithScoreGap = (() => {
    if (!scoreboard?.items) return []
    const sorted = [...scoreboard.items].sort((a, b) => a.rank - b.rank)
    const gapById = new Map<number, number>()
    for (let i = 1; i < sorted.length; i++) {
      gapById.set(sorted[i].id, sorted[i - 1].score - sorted[i].score)
    }
    return scoreboard.items.map((team) => ({
      ...team,
      scoreGap: team.rank === 1 ? undefined : gapById.get(team.id),
    }))
  })()

  const getCurrentGroupTeams = () => {
    if (!scoreboard?.items) return []

    const teamsPerGroup = 10
    const startIndex = currentGroupIndex * teamsPerGroup
    const endIndex = Math.min(startIndex + teamsPerGroup, teamsWithScoreGap.length)

    return teamsWithScoreGap.slice(startIndex, endIndex)
  }

  const currentGroupTeams = getCurrentGroupTeams()

  if (loading) {
    return (
      <div className="min-h-screen deep-space-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold neon-text mb-4">系统初始化中...</div>
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  if (error && !hasData.current) {
    return (
      <div className="min-h-screen deep-space-bg flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>系统错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!scoreboard || !gameDetail || !gameDetails) {
    return (
      <div className="min-h-screen deep-space-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-muted">数据加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen deep-space-bg">
      {/* 后端不可用时的警告横幅 */}
      {error && (
        <div className="bg-yellow-500/15 border-b border-yellow-500/30 px-4 py-1.5 text-center text-xs text-yellow-400">
          {error}
        </div>
      )}
      {/* Header - 响应式 */}
      <div className="glass-panel-header border-b-0 px-3 py-2 lg:px-5 lg:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] items-center gap-2 lg:gap-4">
          <div className="order-2 lg:order-1 flex items-center justify-center lg:justify-start">
            <div
              className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center
                            bg-gradient-to-br from-cyan-500/20 to-blue-600/20
                            backdrop-blur-sm border border-white/20
                            shadow-[0_0_12px_rgba(34,211,238,0.4),inset_0_0_8px_rgba(34,211,238,0.3)]
                            hover:scale-[1.03] transition-transform duration-300"
            >
              <span className="text-white font-bold text-sm lg:text-base drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]">
                ZJCTF
              </span>
            </div>
          </div>

          <div className="order-1 lg:order-2 flex items-center justify-center py-1 lg:py-0">
            <CompetitionTitle title={gameDetail.title} />
          </div>

          <div className="order-3 flex flex-col lg:flex-row items-center justify-center lg:justify-end gap-2 lg:gap-4">
            <div className="flex items-center">
              <SettingsPanel onToggleGUI={() => setIsGUIVisible(!isGUIVisible)} isGUIVisible={isGUIVisible} />
            </div>
            <div className="w-full lg:w-64">
              <CountdownTimer endTimeUtc={gameDetail.end} startTimeUtc={gameDetail.start} title={gameDetail.title} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 响应式布局 */}
      <div className="main-layout flex flex-col lg:flex-row h-[calc(100vh-80px)]">
        {/* Left Panel - Rankings - 响应式，增大宽度 */}
        <div className="sidebar-panel w-full lg:w-1/4 xl:w-1/5" id="rankings-sidebar">
          <div className="glass-panel h-full">
            <div className="glass-panel-header flex justify-between items-center p-3 lg:p-4">
              <span>实时排名</span>
            </div>
            <div className="p-2 lg:p-3 flex-1 overflow-auto sidebar-content">
              <TeamRankings
                teams={currentGroupTeams}
                groupInfo={{
                  currentGroup: currentGroupIndex + 1,
                  totalGroups: totalGroups,
                  totalTeams: scoreboard?.items?.length || 0,
                }}
              />
            </div>
          </div>
        </div>

        {/* Center - Interactive Arena - 响应式 */}
        <div className="center-panel flex-1 min-w-0">
          <div className="h-full relative">
            <InteractiveArena
              events={events || []}
              teams={currentGroupTeams}
              gameDetails={gameDetails}
              allTeams={scoreboard.items || []}
            />

            {/* Add rotation status indicator */}
            <RotationStatus
              isRotating={isRotating}
              currentGroup={currentGroupIndex}
              totalGroups={totalGroups}
              rotationInterval={15000}
            />
          </div>
        </div>

        {/* Right Panel - Events & Top 5 - 响应式 */}
        <div className="sidebar-panel w-full lg:w-1/6 xl:w-1/7 h-full flex flex-col gap-1.5">
          <div className="basis-2/3 min-h-[200px] w-full relative glass-panel flex flex-col overflow-hidden">
            <div className="glass-panel-header flex justify-between items-center p-2 lg:p-3 flex-shrink-0">
              <span>活跃度统计</span>
            </div>
            <div className="p-2 lg:p-3 flex-1 overflow-hidden sidebar-content">
              <EventsFeed events={events || []} />
            </div>
          </div>

          <div className="basis-1/3 min-h-0 w-full relative">
            <TopTeamsAbility scoreboard={scoreboard} />
          </div>
        </div>
      </div>
    </div>
  )
}
