"use client"

import { useMemo } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BloodBadge } from "@/components/blood-badge"
import { getCategoryColor, BLOOD_COLORS } from "@/lib/category-colors"
import { formatTimeAgo, formatTime } from "@/utils/format-time"
import type {
  TeamInfo,
  ScoreboardResponse,
  ChallengeCategory,
} from "@/types/scoreboard"
import type { GameEvent } from "@/types/events"
import {
  X,
  Trophy,
  Target,
  Clock,
  Drop,
  Users,
  Medal,
} from "lucide-react"

interface TeamDetailDrawerProps {
  team: TeamInfo | null
  scoreboard: ScoreboardResponse | null
  events: GameEvent[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 队伍详情抽屉
 *
 * 显示内容：
 * 1. 队伍基本信息（名称、排名、分数、解题数、组织）
 * 2. 一血徽章统计（一血/二血/三血数量）
 * 3. 解题时间线（按时间升序，含题目名、类别、得分、血型、用时）
 * 4. 最近 10 条提交（含失败提交，从事件流筛选）
 */
export function TeamDetailDrawer({
  team,
  scoreboard,
  events,
  open,
  onOpenChange,
}: TeamDetailDrawerProps) {
  // 构建 challengeId -> { title, category, score } 映射
  const challengeMap = useMemo(() => {
    const map = new Map<number, { title: string; category: ChallengeCategory; score: number }>()
    if (scoreboard?.challenges) {
      Object.entries(scoreboard.challenges).forEach(([category, challenges]) => {
        challenges.forEach(c => {
          map.set(c.id, {
            title: c.title,
            category: category as ChallengeCategory,
            score: c.score,
          })
        })
      })
    }
    return map
  }, [scoreboard?.challenges])

  // 题目标题 -> category 反查映射（用于事件流中没有 challengeId 的情况）
  const titleToCategory = useMemo(() => {
    const map = new Map<string, ChallengeCategory>()
    if (scoreboard?.challenges) {
      Object.entries(scoreboard.challenges).forEach(([category, challenges]) => {
        challenges.forEach(c => {
          map.set(c.title, category as ChallengeCategory)
        })
      })
    }
    return map
  }, [scoreboard?.challenges])

  // 解题时间线（按时间升序）
  const solvedTimeline = useMemo(() => {
    if (!team) return []
    return [...team.solvedChallenges]
      .sort((a, b) => a.time - b.time)
      .map(solved => {
        const info = challengeMap.get(solved.id)
        return {
          ...solved,
          title: info?.title || `Challenge #${solved.id}`,
          category: info?.category || ("Misc" as ChallengeCategory),
          originalScore: info?.score || 0,
        }
      })
  }, [team, challengeMap])

  // 一血统计
  const bloodStats = useMemo(() => {
    const stats = { first: 0, second: 0, third: 0 }
    solvedTimeline.forEach(s => {
      if (s.type === "FirstBlood") stats.first++
      else if (s.type === "SecondBlood") stats.second++
      else if (s.type === "ThirdBlood") stats.third++
    })
    return stats
  }, [solvedTimeline])

  // 最近 10 条提交（包括失败，从事件流筛选）
  const recentSubmissions = useMemo(() => {
    if (!team) return []
    return events
      .filter(e => e.type === "FlagSubmit" && e.team === team.name)
      .sort((a, b) => b.time - a.time)
      .slice(0, 10)
      .map(e => {
        const challengeTitle = e.values.length > 2 ? e.values[2] : "Unknown"
        const category = titleToCategory.get(challengeTitle) || ("Misc" as ChallengeCategory)
        return {
          time: e.time,
          accepted: e.values[0] === "Accepted",
          challengeTitle,
          category,
          user: e.user || "",
        }
      })
  }, [team, events, titleToCategory])

  if (!team) return null

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="right-0 left-auto top-0 bottom-0 mt-0 h-full w-full max-w-md rounded-t-none rounded-l-[10px] flex flex-col"
      >
        {/* 头部：队伍信息 + 一血徽章 */}
        <DrawerHeader className="border-b border-border/40 pb-3 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-xl flex items-center gap-2">
                {team.rank === 1 && <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
                <span className="truncate">{team.name}</span>
              </DrawerTitle>
              <DrawerDescription className="mt-1">
                Rank #{team.rank} · {team.score.toLocaleString()} pts · {team.solvedCount} solved
                {team.organization && <> · {team.organization}</>}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <button className="p-1.5 rounded hover:bg-white/10 transition-colors flex-shrink-0" aria-label="关闭">
                <X className="w-4 h-4" />
              </button>
            </DrawerClose>
          </div>

          {/* 一血徽章统计 */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {bloodStats.first > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: `${BLOOD_COLORS.FirstBlood}22`,
                  color: BLOOD_COLORS.FirstBlood,
                  border: `1px solid ${BLOOD_COLORS.FirstBlood}66`,
                }}
              >
                <Drop className="w-3 h-3" style={{ fill: BLOOD_COLORS.FirstBlood }} />
                一血 × {bloodStats.first}
              </span>
            )}
            {bloodStats.second > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: `${BLOOD_COLORS.SecondBlood}22`,
                  color: BLOOD_COLORS.SecondBlood,
                  border: `1px solid ${BLOOD_COLORS.SecondBlood}66`,
                }}
              >
                <Drop className="w-3 h-3" style={{ fill: BLOOD_COLORS.SecondBlood }} />
                二血 × {bloodStats.second}
              </span>
            )}
            {bloodStats.third > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: `${BLOOD_COLORS.ThirdBlood}22`,
                  color: BLOOD_COLORS.ThirdBlood,
                  border: `1px solid ${BLOOD_COLORS.ThirdBlood}66`,
                }}
              >
                <Drop className="w-3 h-3" style={{ fill: BLOOD_COLORS.ThirdBlood }} />
                三血 × {bloodStats.third}
              </span>
            )}
            {bloodStats.first + bloodStats.second + bloodStats.third === 0 && (
              <span className="text-xs text-muted-foreground">暂无一血/二血/三血</span>
            )}
          </div>

          {/* 队员列表 */}
          {team.members && team.members.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Users className="w-3 h-3" />
              <span className="truncate">{team.members.join(" · ")}</span>
            </div>
          )}
        </DrawerHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {/* 解题时间线 */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-cyan-400">
                <Clock className="w-4 h-4" />
                解题时间线 ({solvedTimeline.length})
              </h3>
              <div className="space-y-1.5">
                {solvedTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">暂无解题记录</p>
                ) : (
                  solvedTimeline.map((s, i) => {
                    const color = getCategoryColor(s.category)
                    return (
                      <div
                        key={`${s.id}-${i}`}
                        className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{s.title}</span>
                            <BloodBadge type={s.type} />
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            <span style={{ color }}>{s.category}</span>
                            <span className="mx-1">·</span>
                            {formatTime(s.time)}
                            {s.userName && (
                              <>
                                <span className="mx-1">·</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <Medal className="w-2.5 h-2.5" />
                                  {s.userName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-mono text-cyan-400 flex-shrink-0">
                          +{s.score}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* 最近 10 条提交 */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-purple-400">
                <Target className="w-4 h-4" />
                最近提交 ({recentSubmissions.length}/10)
              </h3>
              <div className="space-y-1">
                {recentSubmissions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">暂无提交记录</p>
                ) : (
                  recentSubmissions.map((s, i) => {
                    const color = getCategoryColor(s.category)
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${s.accepted ? "bg-green-500" : "bg-red-500"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate">{s.challengeTitle}</div>
                          <div className="text-[10px] text-muted-foreground">
                            <span style={{ color }}>{s.category}</span>
                            <span className="mx-1">·</span>
                            {formatTimeAgo(s.time)}
                            {s.user && (
                              <>
                                <span className="mx-1">·</span>
                                {s.user}
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold flex-shrink-0 ${
                            s.accepted ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {s.accepted ? "通过" : "失败"}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
