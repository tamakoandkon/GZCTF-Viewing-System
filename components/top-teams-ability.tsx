"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import type { ScoreboardResponse, ChallengeCategory } from "@/types/scoreboard"
import { useTheme } from "@/contexts/theme-context"
import { Trophy, Medal, Star } from "lucide-react"

interface TopTeamsAbilityProps {
  scoreboard: ScoreboardResponse
}

export function TopTeamsAbility({ scoreboard }: TopTeamsAbilityProps) {
  const { isDark } = useTheme()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const topTeams = useMemo(() => {
    const items = scoreboard?.items
    if (!items || !Array.isArray(items)) return []
    return [...items].sort((a, b) => a.rank - b.rank).slice(0, 5)
  }, [scoreboard?.items, scoreboard])

  // 构建挑战ID到类别的映射
  const challengeIdToCategory = useMemo(() => {
    const map = new Map<number, ChallengeCategory>()
    if (!scoreboard?.challenges) return map
    Object.entries(scoreboard.challenges).forEach(([category, challenges]) => {
      challenges.forEach((challenge) => {
        map.set(challenge.id, category as ChallengeCategory)
      })
    })
    return map
  }, [scoreboard.challenges])

  // 计算当前展示队伍的数据
  const currentTeamData = useMemo(() => {
    if (topTeams.length === 0) return null
    const team = topTeams[currentIndex]

    const stats: Record<string, { solved: number; total: number }> = {}
    
    if (scoreboard?.challenges) {
      Object.entries(scoreboard.challenges).forEach(([category, challenges]) => {
        stats[category] = { solved: 0, total: challenges.length }
      })
    }

    team.solvedChallenges.forEach((solved) => {
      const category = challengeIdToCategory.get(solved.id)
      if (category && stats[category]) {
        stats[category].solved++
      }
    })

    return Object.entries(stats)
      .map(([category, { solved, total }]) => {
        const value = total > 0 ? (solved / total) * 100 : 0
        return {
          name: category,
          value: value,
          // Label for axis: Category + Percentage
          label: `${category}`,
          percentage: `${value.toFixed(1)}%`,
          solved,
          total,
        }
      })
      .filter(item => item.total > 0) // 只显示有题目的类别
  }, [topTeams, currentIndex, scoreboard.challenges, challengeIdToCategory])

  useEffect(() => {
    if (currentIndex >= topTeams.length) setCurrentIndex(0)
  }, [currentIndex, topTeams.length])

  useEffect(() => {
    if (topTeams.length <= 1) return

    const interval = setInterval(() => {
      setIsTransitioning(true)
      // 先换数据（在 opacity-0 时渲染），下一帧再恢复可见，避免 ResponsiveContainer 重测布局时抖动
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % topTeams.length)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsTransitioning(false)
          })
        })
      }, 400)
    }, 15000)

    return () => clearInterval(interval)
  }, [topTeams.length])

  if (topTeams.length === 0) return null

  const currentTeam = topTeams[currentIndex]

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />
      default:
        return <Star className="w-6 h-6 text-blue-400" />
    }
  }

  // 類別顏色映射（與地球上高亮顏色一致）
  const categoryColors: Record<string, string> = {
    Web: '#ff6b6b', Crypto: '#4ecdc4', Pwn: '#45b7d1', Reverse: '#96ceb4',
    Blockchain: '#feca57', Forensics: '#ff9ff3', Hardware: '#54a0ff', Mobile: '#5f27cd',
    PPC: '#00d2d3', AI: '#ff6348', Pentest: '#2ed573', OSINT: '#ffa502', Misc: '#ff7675'
  }

  // Custom tick for PolarAngleAxis — 顏色匹配地球高亮
  const renderPolarAngleAxis = ({ payload, x, y, cx, cy, ...rest }: any) => {
    const catColor = categoryColors[payload.value] || (isDark ? '#E5E7EB' : '#374151')
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={13}
        fontWeight="bold"
      >
        <tspan x={x} dy="0em" fill={catColor}>{payload.value}</tspan>
        <tspan x={x} dy="1.2em" fontSize={10} fill={isDark ? '#9CA3AF' : '#6B7280'}>
          {currentTeamData?.find(d => d.name === payload.value)?.percentage}
        </tspan>
      </text>
    )
  }

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      <div className="glass-panel-header p-2 lg:p-3 flex justify-between items-center flex-shrink-0">
        <span className="font-bold text-lg neon-text">Top5能力展示</span>
        <div className="flex gap-1">
          {topTeams.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? "bg-cyan-400 scale-125" : "bg-gray-600"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col min-h-0 relative">
        <div
          className={`flex-1 flex flex-col transition-opacity duration-500 ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
              {getRankIcon(currentTeam.rank)}
            </div>
            <div>
              <div className="text-xl font-bold text-white truncate max-w-[180px]" title={currentTeam.name}>
                {currentTeam.name}
              </div>
              <div className="text-sm text-muted">
                Rank #{currentTeam.rank} | Score: {currentTeam.score}
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={currentTeamData || []}>
                <PolarGrid stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"} />
                <PolarAngleAxis
                  dataKey="name"
                  tick={renderPolarAngleAxis}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "rgba(17, 24, 39, 0.9)" : "rgba(255, 255, 255, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    backdropFilter: "blur(4px)",
                  }}
                  itemStyle={{ color: isDark ? "#fff" : "#000" }}
                  cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                  formatter={(value: number, name: string, props: any) => [
                    `${props.payload.solved}/${props.payload.total} (${value.toFixed(1)}%)`,
                    "完成度",
                  ]}
                />
                <Radar
                  name={currentTeam.name}
                  dataKey="value"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="#3B82F6"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
