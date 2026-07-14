"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getScoreboard, getEvents, getGameDetail, getGameDetails } from "@/services/api"
import { isAuthenticated } from "@/services/auth-service"
import type { ScoreboardResponse, ChallengeCategory } from "@/types/scoreboard"
import type { EventsResponse } from "@/types/events"
import type { GameDetail } from "@/types/game"
import type { GameDetails } from "@/types/challenge"
import { TeamRankings } from "@/components/team-rankings"
import { EventsFeed } from "@/components/events-feed"
import { TopTeamsAbility } from "@/components/top-teams-ability"
import { CountdownTimer } from "@/components/countdown-timer"
import { InteractiveArena } from "@/components/interactive-arena"
import { AlertCircle, MessageCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RotationStatus } from "@/components/rotation-status"
import { SettingsPanel } from "@/components/settings-panel"
import { CompetitionTitle } from "@/components/competition-title"
import { TeamDetailDrawer } from "@/components/team-detail-drawer"
import { ChallengeLeaderboard } from "@/components/challenge-leaderboard"
import { Danmaku } from "@/components/danmaku"
import { useFirstBloodDanmaku } from "@/hooks/use-first-blood-danmaku"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { useTheme } from "@/contexts/theme-context"
import type { TeamInfo } from "@/types/scoreboard"

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
  const [currentChallengePage, setCurrentChallengePage] = useState(0)
  const challengesPerPage = 8
  const [isRotating, setIsRotating] = useState(true)
  const [totalGroups, setTotalGroups] = useState(0)
  const [totalChallengePages, setTotalChallengePages] = useState(1)
  const [isGUIVisible, setIsGUIVisible] = useState(false)
  // 队伍详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<TeamInfo | null>(null)
  // 弹幕 & 音效开关
  const [danmakuEnabled, setDanmakuEnabled] = useState(true)
  // 左侧面板 tab 切换
  const [activeTab, setActiveTab] = useState("teams")
  const { isDark } = useTheme()

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

  // 自动轮播：20s 翻页 + 5min 切换榜单
  useEffect(() => {
    if (!scoreboard?.items || scoreboard.items.length === 0) return

    const teamsPerGroup = 10
    const calculatedTotalGroups = Math.ceil(scoreboard.items.length / teamsPerGroup)
    setTotalGroups(calculatedTotalGroups)

    // 计算题目总页数
    let totalChallenges = 0
    if (scoreboard?.challenges) {
      Object.values(scoreboard.challenges).forEach(items => {
        totalChallenges += items.length
      })
    }
    const challengePages = Math.max(1, Math.ceil(totalChallenges / challengesPerPage))
    setTotalChallengePages(challengePages)

    // 20s 翻页
    const pageInterval = setInterval(() => {
      setActiveTab(prev => {
        if (prev === "teams") {
          setCurrentGroupIndex(idx => (idx + 1) % calculatedTotalGroups)
        } else {
          setCurrentChallengePage(p => (p + 1) % challengePages)
        }
        return prev
      })
    }, 20000)

    // 5min 切换榜单
    const tabInterval = setInterval(() => {
      setActiveTab(prev => {
        if (prev === "teams") {
          setCurrentChallengePage(0)
          return "challenges"
        } else {
          setCurrentGroupIndex(0)
          return "teams"
        }
      })
    }, 300000)

    setIsRotating(calculatedTotalGroups > 1 || challengePages > 1)

    return () => {
      clearInterval(pageInterval)
      clearInterval(tabInterval)
    }
  }, [scoreboard?.items, scoreboard?.challenges, challengesPerPage])

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

  // 题目榜分页：只传当前页的题目数据
  const paginatedScoreboard = (() => {
    if (!scoreboard?.challenges) return scoreboard
    const allEntries = Object.entries(scoreboard.challenges).flatMap(([cat, items]) =>
      items.map(c => ({ cat: cat as ChallengeCategory, ...c }))
    )
    const start = currentChallengePage * challengesPerPage
    const pageItems = allEntries.slice(start, start + challengesPerPage)
    const challenges: Record<string, typeof pageItems> = {}
    pageItems.forEach(c => {
      if (!challenges[c.cat]) challenges[c.cat] = []
      challenges[c.cat].push(c)
    })
    return { ...scoreboard, challenges }
  })() as ScoreboardResponse

  // 一血弹幕监听（scoreboard 更新时自动检测新一血并触发弹幕 + 音效）
  const { danmakuQueue, removeDanmaku } = useFirstBloodDanmaku(scoreboard, {
    enabled: danmakuEnabled,
    soundEnabled: false,
  })

  // 点击队伍 → 打开详情抽屉 + 3D 镜头跟随该队伍飞船
  const handleTeamClick = (teamId: number) => {
    const team = scoreboard?.items?.find(t => t.id === teamId)
    if (team) {
      setSelectedTeam(team)
      setDrawerOpen(true)
      // 通知 3D 场景镜头平滑跟随到该队伍飞船（若飞船存在则跟随，否则监听器无操作）
      window.dispatchEvent(
        new CustomEvent("team:focus", { detail: { teamId } })
      )
    }
  }

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
            <div className="flex items-center gap-1.5">
              {/* 弹幕开关 */}
              <button
                onClick={() => setDanmakuEnabled(prev => !prev)}
                className={`p-1.5 lg:p-2 rounded-lg border transition-colors ${
                  danmakuEnabled
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                    : "bg-white/5 border-white/10 text-muted-foreground"
                }`}
                title={danmakuEnabled ? "关闭弹幕" : "开启弹幕"}
                aria-label="切换弹幕"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
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
        {/* Left Panel - Rankings / Challenges - 响应式，增大宽度 */}
        <div className="sidebar-panel w-full lg:w-1/4 xl:w-1/5" id="rankings-sidebar">
          <div className="glass-panel h-full flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              {/* 自定义 Tab 头部 — 与右侧「活跃度统计」同款风格 */}
              <div
                className="flex-shrink-0 glass-panel p-2 lg:p-3 neon-border glow-effect"
                style={{ color: isDark ? "#67E8F9" : "#00BCD4" }}
              >
                <div className="text-center">
                  <div className="text-sm lg:text-base font-bold mb-1.5 lg:mb-2">
                    {activeTab === "teams" ? "队伍榜" : "题目榜"}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setActiveTab("teams")}
                      className="flex-1 py-1 text-xs rounded-full border transition-all font-medium"
                      style={
                        activeTab === "teams"
                          ? {
                              color: isDark ? "#67E8F9" : "#00BCD4",
                              backgroundColor: isDark ? "rgba(103,232,249,0.15)" : "rgba(0,188,212,0.15)",
                              borderColor: isDark ? "rgba(103,232,249,0.5)" : "rgba(0,188,212,0.5)",
                              boxShadow: isDark ? "0 0 10px rgba(103,232,249,0.3)" : "0 0 8px rgba(0,188,212,0.25)",
                            }
                          : {
                              color: isDark ? "#9CA3AF" : "#6B7280",
                              backgroundColor: "transparent",
                              borderColor: "transparent",
                            }
                      }
                    >
                      队伍榜
                    </button>
                    <button
                      onClick={() => setActiveTab("challenges")}
                      className="flex-1 py-1 text-xs rounded-full border transition-all font-medium"
                      style={
                        activeTab === "challenges"
                          ? {
                              color: isDark ? "#67E8F9" : "#00BCD4",
                              backgroundColor: isDark ? "rgba(103,232,249,0.15)" : "rgba(0,188,212,0.15)",
                              borderColor: isDark ? "rgba(103,232,249,0.5)" : "rgba(0,188,212,0.5)",
                              boxShadow: isDark ? "0 0 10px rgba(103,232,249,0.3)" : "0 0 8px rgba(0,188,212,0.25)",
                            }
                          : {
                              color: isDark ? "#9CA3AF" : "#6B7280",
                              backgroundColor: "transparent",
                              borderColor: "transparent",
                            }
                      }
                    >
                      题目榜
                    </button>
                  </div>
                  {/* 进度条装饰 — 与活跃度统计一致 */}
                  <div className="w-full bg-muted/50 rounded-full h-1.5 lg:h-2 overflow-hidden mt-2">
                    <div
                      className="h-1.5 lg:h-2 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: activeTab === "teams" ? "50%" : "100%",
                        background: isDark
                          ? "linear-gradient(90deg, #67E8F9, #D8B4FE)"
                          : "linear-gradient(90deg, #81D4FA, #CE93D8)",
                        boxShadow: isDark ? "0 0 10px #67E8F9" : "0 0 8px #81D4FA",
                      }}
                    />
                  </div>
                </div>
              </div>
              <TabsContent value="teams" className="flex-1 min-h-0 mt-0 p-2 lg:p-3 overflow-auto sidebar-content data-[state=inactive]:hidden">
                <TeamRankings
                  teams={currentGroupTeams}
                  onTeamClick={handleTeamClick}
                  groupInfo={{
                    currentGroup: currentGroupIndex + 1,
                    totalGroups: totalGroups,
                    totalTeams: scoreboard?.items?.length || 0,
                  }}
                />
              </TabsContent>
              <TabsContent value="challenges" className="flex-1 min-h-0 mt-0 p-2 lg:p-3 data-[state=inactive]:hidden">
                <ChallengeLeaderboard
                  scoreboard={paginatedScoreboard}
                  teamCount={gameDetails?.teamCount || 0}
                  gameStartTime={gameDetail.start}
                />
              </TabsContent>
            </Tabs>
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
              rotationInterval={20000}
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

      {/* 一血弹幕层 */}
      <Danmaku items={danmakuQueue} onItemExpire={removeDanmaku} />

      {/* 队伍详情抽屉 */}
      <TeamDetailDrawer
        team={selectedTeam}
        scoreboard={scoreboard}
        events={events || []}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
