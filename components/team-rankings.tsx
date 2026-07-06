"use client"
import { useState, useEffect } from "react"
import type { TeamInfo } from "@/types/scoreboard"
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

interface TeamRankingsProps {
  teams: TeamInfo[]
  groupInfo?: {
    currentGroup: number
    totalGroups: number
    totalTeams: number
  }
  onTeamHover?: (teamId: number | null) => void
  onTeamClick?: (teamId: number) => void
}

export function TeamRankings({ teams, groupInfo, onTeamHover, onTeamClick }: TeamRankingsProps) {
  const [hoveredTeam, setHoveredTeam] = useState<number | null>(null)
  const [previousRankings, setPreviousRankings] = useState<Record<number, number>>({})
  const { isDark } = useTheme()

  const topThreeTeams = teams.filter((team) => [1, 2, 3].includes(team.rank))
  const otherTeams = teams.filter((team) => ![1, 2, 3].includes(team.rank))

  // 计算最高分作为进度条基准
  const maxScore = teams.length > 0 ? Math.max(...teams.map(team => team.score)) : 0

  useEffect(() => {
    const newRankings: Record<number, number> = {}
    teams.forEach((team) => (newRankings[team.id] = team.rank))
    setPreviousRankings(newRankings)
  }, [teams])

  const getRankingChange = (teamId: number, currentRank: number) => {
    const previousRank = previousRankings[teamId]
    if (!previousRank) return null
    return previousRank > currentRank ? "up" : previousRank < currentRank ? "down" : "same"
  }

  const formatScoreGap = (team: TeamInfo) => {
    if (team.rank === 1) return "—"
    if (typeof team.scoreGap === "number") return `+${team.scoreGap.toLocaleString()}`
    const prev = teams.find((t) => t.rank === team.rank - 1)
    if (prev) return `+${(prev.score - team.score).toLocaleString()}`
    return "—"
  }

  // 主题适配的题目类别颜色
  const getCategoryColor = (category: string) => {
    if (isDark) {
      const colors: Record<string, string> = {
        Web: "#67E8F9",
        Crypto: "#D8B4FE",
        Reverse: "#FACC15",
        Misc: "#4ADE80",
        Pwn: "#EF4444",
        Forensics: "#A78BFA",
        Blockchain: "#EC4899",
        Hardware: "#10B981",
        Mobile: "#3B82F6",
        PPC: "#F59E0B",
        AI: "#8B5CF6",
        Pentest: "#EF4444",
        OSINT: "#06B6D4",
      }
      return colors[category] || "#67E8F9"
    } else {
      const colors: Record<string, string> = {
        Web: "#81D4FA",
        Crypto: "#CE93D8",
        Reverse: "#FFE082",
        Misc: "#AED581",
        Pwn: "#F8BBD0",
        Forensics: "#D1C4E9",
        Blockchain: "#F8BBD0",
        Hardware: "#C8E6C9",
        Mobile: "#4FC3F7",
        PPC: "#FFCC02",
        AI: "#CE93D8",
        Pentest: "#F8BBD0",
        OSINT: "#4FC3F7",
      }
      return colors[category] || "#81D4FA"
    }
  }

  const handleTeamHover = (teamId: number | null) => {
    setHoveredTeam(teamId)
    onTeamHover?.(teamId)
  }

  const renderScoreProgressBar = (team: TeamInfo) => {
    const progressPercentage = maxScore > 0 ? (team.score / maxScore) * 100 : 0
    
    return (
      <div className="w-full mt-2">
        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${progressPercentage}%`,
              background: isDark
                ? "linear-gradient(90deg, #67E8F9, #D8B4FE)"
                : "linear-gradient(90deg, #81D4FA, #CE93D8)",
              boxShadow: isDark ? "0 0 6px #67E8F9" : "0 0 4px #81D4FA",
            }}
          />
        </div>
      </div>
    )
  }

  const renderTeamItem = (team: TeamInfo, index: number, isTopThree = false) => {
    const change = getRankingChange(team.id, team.rank)
    const isHovered = hoveredTeam === team.id

    // 主题适配的排名颜色
    let rankColor = isDark ? "#67E8F9" : "#00BCD4"
    let badgeStyle: Record<string, string> = {
      backgroundColor: isDark ? "rgba(103, 232, 249, 0.1)" : "rgba(0, 188, 212, 0.1)",
      color: isDark ? "#67E8F9" : "#00BCD4",
      borderColor: isDark ? "rgba(103, 232, 249, 0.3)" : "rgba(0, 188, 212, 0.3)",
    }

    if (isTopThree) {
      switch (team.rank) {
        case 1:
          rankColor = isDark ? "#FFD700" : "#FFE082"
          badgeStyle = {
            backgroundColor: isDark ? "rgba(255, 215, 0, 0.25)" : "rgba(255, 224, 130, 0.3)",
            color: isDark ? "#FFD700" : "#FFE082",
            borderColor: isDark ? "rgba(255, 215, 0, 0.8)" : "rgba(255, 224, 130, 0.8)",
            boxShadow: isDark ? "0 0 15px rgba(255, 215, 0, 0.6)" : "0 0 12px rgba(255, 224, 130, 0.5)",
          }
          break
        case 2:
          rankColor = isDark ? "#C0C0C0" : "#E0E0E0"
          badgeStyle = {
            backgroundColor: isDark ? "rgba(192, 192, 192, 0.25)" : "rgba(224, 224, 224, 0.3)",
            color: isDark ? "#C0C0C0" : "#E0E0E0",
            borderColor: isDark ? "rgba(192, 192, 192, 0.8)" : "rgba(224, 224, 224, 0.8)",
            boxShadow: isDark ? "0 0 12px rgba(192, 192, 192, 0.5)" : "0 0 10px rgba(224, 224, 224, 0.4)",
          }
          break
        case 3:
          rankColor = isDark ? "#CD7F32" : "#E9C46A"
          badgeStyle = {
            backgroundColor: isDark ? "rgba(205, 127, 50, 0.25)" : "rgba(233, 196, 106, 0.3)",
            color: isDark ? "#CD7F32" : "#E9C46A",
            borderColor: isDark ? "rgba(205, 127, 50, 0.8)" : "rgba(233, 196, 106, 0.8)",
            boxShadow: isDark ? "0 0 10px rgba(205, 127, 50, 0.4)" : "0 0 8px rgba(233, 196, 106, 0.3)",
          }
          break
      }
    }

    return (
      <div
        key={team.id}
        className="glass-panel p-3 cursor-pointer transition-all duration-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-transparent fade-in-up hover-lift"
        style={{
          animationDelay: `${index * 0.03}s`,
          borderColor: "rgba(255,255,255,0.05)",
          boxShadow: "none",
        }}
        onMouseEnter={() => handleTeamHover(team.id)}
        onMouseLeave={() => handleTeamHover(null)}
        onClick={() => onTeamClick?.(team.id)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 neon-border font-mono ${
              isTopThree && team.rank === 1
                ? "rank-gold"
                : isTopThree && team.rank === 2
                  ? "rank-silver"
                  : isTopThree && team.rank === 3
                    ? "rank-bronze"
                    : ""
            }`}
            style={badgeStyle}
          >
            {team.rank}
            {team.rank === 1 && <Trophy className="w-4 h-4 ml-0.5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-primary truncate">{team.name}</span>
              {change === "up" && <TrendingUp className="w-3 h-3 text-success-green" />}
              {change === "down" && <TrendingDown className="w-3 h-3 text-danger-red" />}
              {change === "same" && <Minus className="w-3 h-3 text-muted" />}
            </div>

            <div className="flex items-center gap-2 mb-1 flex-nowrap">
              <span
                className="text-sm font-mono whitespace-nowrap"
                style={{ color: isTopThree ? rankColor : isDark ? "#67E8F9" : "#00BCD4" }}
              >
                {team.score.toLocaleString()} pts
              </span>
              <div
                className="w-[60px] flex items-center justify-center flex-shrink-0 text-[12px] font-mono whitespace-nowrap"
                style={{ color: "#FF6B00" }}
              >
                {formatScoreGap(team)}
              </div>
              <span className="text-xs text-muted whitespace-nowrap">{team.solvedCount} 题</span>
            </div>

            {/* 得分进度条 */}
            {renderScoreProgressBar(team)}

            {isTopThree && team.solvedChallenges.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {team.solvedChallenges.slice(0, 4).map((challenge, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: getCategoryColor(challenge.type),
                      boxShadow: `0 0 3px ${getCategoryColor(challenge.type)}`,
                    }}
                    title={challenge.type}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="glass-panel p-6 text-center">
        <div className="text-muted">暂无队伍数据</div>
      </div>
    )
  }

  return (
    <div className="space-y-2 lg:space-y-4 h-full flex flex-col">
      {groupInfo && groupInfo.totalGroups > 1 && (
        <div className="flex-shrink-0 glass-panel p-3 lg:p-5 neon-border glow-effect" style={{ color: isDark ? "#67E8F9" : "#00BCD4" }}>
          <div className="text-center">
            <div className="text-base lg:text-xl font-bold mb-1.5 lg:mb-2.5">
              GROUP {groupInfo.currentGroup} / {groupInfo.totalGroups}
            </div>
            <div className="text-xs lg:text-sm text-muted mb-2 lg:mb-3">
              显示队伍 {(groupInfo.currentGroup - 1) * 10 + 1} -{" "}
              {Math.min(groupInfo.currentGroup * 10, groupInfo.totalTeams)} / {groupInfo.totalTeams}
            </div>
            <div className="w-full bg-muted/50 rounded-full h-1.5 lg:h-2 overflow-hidden">
              <div
                className="h-1.5 lg:h-2 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${(groupInfo.currentGroup / groupInfo.totalGroups) * 100}%`,
                  background: isDark
                    ? "linear-gradient(90deg, #67E8F9, #D8B4FE)"
                    : "linear-gradient(90deg, #81D4FA, #CE93D8)",
                  boxShadow: isDark ? "0 0 10px #67E8F9" : "0 0 8px #81D4FA",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <div className="space-y-1.5 lg:space-y-2.5 overflow-y-auto h-full pr-1 lg:pr-2">
          {topThreeTeams.map((team, index) => renderTeamItem(team, index, true))}
          {otherTeams.map((team, index) => renderTeamItem(team, topThreeTeams.length + index, false))}
        </div>
      </div>
    </div>
  )
}
