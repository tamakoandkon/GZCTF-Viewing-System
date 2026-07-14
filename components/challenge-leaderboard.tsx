"use client"

import { useMemo, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { getCategoryColor, BLOOD_COLORS } from "@/lib/category-colors"
import { useTheme } from "@/contexts/theme-context"
import type {
  ScoreboardResponse,
  ChallengeCategory,
  ChallengeInfo,
} from "@/types/scoreboard"
import { Search, Droplet, Percent, Clock, CheckCircle2 } from "lucide-react"

interface ChallengeLeaderboardProps {
  scoreboard: ScoreboardResponse
  /** 参赛队伍总数（用于计算解题率） */
  teamCount: number
  /** 比赛开始时间（用于计算用时） */
  gameStartTime: number
}

/**
 * 持续时间格式化
 */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "-"
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${totalMinutes % 60}m`
  return `${totalMinutes}m`
}

type EnrichedChallenge = ChallengeInfo & { category: ChallengeCategory }

/**
 * 题目维度视图
 *
 * 每道题展示：
 * - 题目名、类别、原始分数
 * - 解题数 / 解题率（解题数 / 参赛队伍数）
 * - 一血 / 二血 / 三血（队伍名 + 用时）
 * - 平均解题用时（从所有解题队伍的 solvedChallenges 聚合）
 *
 * 视觉风格对齐队伍榜：glass-panel + neon-border + 渐变发光进度条 + fade-in-up + 主题适配
 */
export function ChallengeLeaderboard({
  scoreboard,
  teamCount,
  gameStartTime,
}: ChallengeLeaderboardProps) {
  const { isDark } = useTheme()
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<ChallengeCategory | "all">("all")

  // 主题适配的强调色
  const accentPrimary = isDark ? "#67E8F9" : "#00BCD4"
  const accentSecondary = isDark ? "#D8B4FE" : "#CE93D8"

  // 拍平所有题目
  const allChallenges = useMemo<EnrichedChallenge[]>(() => {
    if (!scoreboard?.challenges) return []
    const list: EnrichedChallenge[] = []
    Object.entries(scoreboard.challenges).forEach(([cat, items]) => {
      items.forEach(c => list.push({ ...c, category: cat as ChallengeCategory }))
    })
    return list
  }, [scoreboard?.challenges])

  // 计算每道题的平均解题用时
  const avgSolveTimeMap = useMemo(() => {
    const map = new Map<number, number>()
    if (!scoreboard?.items || !gameStartTime) return map
    const acc = new Map<number, { totalTime: number; count: number }>()
    scoreboard.items.forEach(team => {
      team.solvedChallenges.forEach(s => {
        const dur = s.time - gameStartTime
        if (dur < 0) return
        const cur = acc.get(s.id) || { totalTime: 0, count: 0 }
        cur.totalTime += dur
        cur.count += 1
        acc.set(s.id, cur)
      })
    })
    acc.forEach((v, k) => {
      map.set(k, v.count > 0 ? v.totalTime / v.count : 0)
    })
    return map
  }, [scoreboard?.items, gameStartTime])

  // 可用类别列表
  const categories = useMemo(() => {
    return Array.from(new Set(allChallenges.map(c => c.category)))
  }, [allChallenges])

  // 过滤后的题目
  const filteredChallenges = useMemo(() => {
    return allChallenges.filter(c => {
      if (filterCategory !== "all" && c.category !== filterCategory) return false
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [allChallenges, search, filterCategory])

  // 统计概览
  const stats = useMemo(() => {
    const total = allChallenges.length
    const solved = allChallenges.filter(c => c.solved > 0).length
    const totalSolves = allChallenges.reduce((sum, c) => sum + c.solved, 0)
    return { total, solved, unsolved: total - solved, totalSolves }
  }, [allChallenges])

  return (
    <div className="h-full flex flex-col gap-2">
      {/* 概览统计 - glass-panel 风格 */}
      <div
        className="glass-panel p-2.5 flex-shrink-0 fade-in-up neon-border"
        style={{ animationDelay: "0s" }}
      >
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div
              className="text-base font-bold font-mono"
              style={{ color: accentPrimary, textShadow: isDark ? `0 0 6px ${accentPrimary}` : "none" }}
            >
              {stats.total}
            </div>
            <div className="text-[9px] text-muted uppercase tracking-wider">题目</div>
          </div>
          <div>
            <div
              className="text-base font-bold font-mono"
              style={{ color: "#4ADE80", textShadow: isDark ? "0 0 6px #4ADE80" : "none" }}
            >
              {stats.solved}
            </div>
            <div className="text-[9px] text-muted uppercase tracking-wider">已解</div>
          </div>
          <div>
            <div
              className="text-base font-bold font-mono"
              style={{ color: "#EF4444", textShadow: isDark ? "0 0 6px #EF4444" : "none" }}
            >
              {stats.unsolved}
            </div>
            <div className="text-[9px] text-muted uppercase tracking-wider">未解</div>
          </div>
          <div>
            <div
              className="text-base font-bold font-mono"
              style={{ color: accentSecondary, textShadow: isDark ? `0 0 6px ${accentSecondary}` : "none" }}
            >
              {stats.totalSolves}
            </div>
            <div className="text-[9px] text-muted uppercase tracking-wider">总解</div>
          </div>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative flex-shrink-0">
        <Search
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3"
          style={{ color: accentPrimary }}
        />
        <Input
          placeholder="搜索题目..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 pl-7 text-xs"
        />
      </div>

      {/* 类别过滤 - 霓虹标签风格 */}
      <div className="flex gap-1 flex-wrap flex-shrink-0">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-2 py-0.5 text-[10px] rounded-full transition-all duration-200 border ${
            filterCategory === "all"
              ? "neon-border"
              : "bg-white/5 border-transparent hover:bg-white/10"
          }`}
          style={
            filterCategory === "all"
              ? {
                  backgroundColor: isDark ? "rgba(103, 232, 249, 0.15)" : "rgba(0, 188, 212, 0.1)",
                  color: accentPrimary,
                  borderColor: isDark ? "rgba(103, 232, 249, 0.5)" : "rgba(0, 188, 212, 0.4)",
                }
              : { color: "var(--muted)" }
          }
        >
          全部 ({allChallenges.length})
        </button>
        {categories.map(cat => {
          const count = allChallenges.filter(c => c.category === cat).length
          const color = getCategoryColor(cat)
          const active = filterCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-all duration-200 border ${
                active ? "" : "border-transparent hover:bg-white/10"
              }`}
              style={{
                color,
                backgroundColor: active ? `${color}22` : undefined,
                borderColor: active ? `${color}66` : undefined,
                boxShadow: active ? `0 0 8px ${color}44` : undefined,
              }}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* 题目列表 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-1.5 lg:space-y-2 pr-2">
          {filteredChallenges.length === 0 ? (
            <div className="glass-panel p-6 text-center">
              <div className="text-muted text-sm">无匹配题目</div>
            </div>
          ) : (
            filteredChallenges.map((challenge, index) => {
              const color = getCategoryColor(challenge.category)
              const solveRate = teamCount > 0 ? (challenge.solved / teamCount) * 100 : 0
              const bloods = challenge.bloods || []
              const avgTime = avgSolveTimeMap.get(challenge.id) || 0
              const isSolved = challenge.solved > 0

              return (
                <div
                  key={challenge.id}
                  className="glass-panel p-2.5 transition-all duration-200 hover:bg-white/5 fade-in-up"
                  style={{
                    animationDelay: `${index * 0.03}s`,
                    borderColor: "rgba(255,255,255,0.05)",
                    boxShadow: "none",
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  {/* 题目标题行 */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-primary truncate">
                          {challenge.title}
                        </span>
                        {!isSolved && (
                          <span
                            className="text-[9px] px-1 py-0.5 rounded font-semibold flex-shrink-0"
                            style={{
                              backgroundColor: "rgba(239, 68, 68, 0.15)",
                              color: "#EF4444",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            未解出
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <span style={{ color }}>{challenge.category}</span>
                        <span>·</span>
                        <span className="font-mono">{challenge.score} pts</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-xs font-mono flex items-center gap-0.5 justify-end"
                        style={{ color: accentPrimary }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {challenge.solved}
                      </div>
                      <div className="text-[10px] text-muted-foreground">solved</div>
                    </div>
                  </div>

                  {/* 解题率进度条 - 渐变发光风格，对齐队伍榜 */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between text-[10px] mb-0.5 text-white/70">
                      <span className="flex items-center gap-0.5">
                        <Percent className="w-2.5 h-2.5" />
                        解题率
                      </span>
                      <span className="font-mono text-white/90">{solveRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${Math.min(solveRate, 100)}%`,
                          background: isDark
                            ? `linear-gradient(90deg, ${color}, ${accentSecondary})`
                            : `linear-gradient(90deg, ${color}, ${accentSecondary})`,
                          boxShadow: isDark ? `0 0 6px ${color}` : `0 0 4px ${color}`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 一血 / 二血 / 三血 - 霓虹徽章风格 */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {bloods.slice(0, 3).map((blood, idx) => {
                      const bloodColor =
                        idx === 0
                          ? BLOOD_COLORS.FirstBlood
                          : idx === 1
                            ? BLOOD_COLORS.SecondBlood
                            : BLOOD_COLORS.ThirdBlood
                      const label = idx === 0 ? "一血" : idx === 1 ? "二血" : "三血"
                      return (
                        <div
                          key={blood.id}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${bloodColor}1A`,
                            border: `1px solid ${bloodColor}55`,
                            boxShadow: isDark ? `0 0 6px ${bloodColor}33` : "none",
                          }}
                        >
                          <Droplet
                            className="w-2.5 h-2.5 flex-shrink-0"
                            style={{ fill: bloodColor, color: bloodColor }}
                          />
                          <span style={{ color: bloodColor }} className="font-semibold">
                            {label}
                          </span>
                          <span className="text-white/90 truncate max-w-[70px]">
                            {blood.name}
                          </span>
                          {blood.submitTimeUtc && (
                            <span className="text-white/60 font-mono">
                              {formatDuration(blood.submitTimeUtc - gameStartTime)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {bloods.length === 0 && (
                      <span className="text-[10px] text-muted-foreground">无人解出</span>
                    )}
                  </div>

                  {/* 平均用时 */}
                  {avgTime > 0 && (
                    <div className="text-[10px] flex items-center gap-0.5 text-white/70">
                      <Clock className="w-2.5 h-2.5" />
                      平均用时:{" "}
                      <span className="font-mono text-white/90">
                        {formatDuration(avgTime)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
