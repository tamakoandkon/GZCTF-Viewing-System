"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, ChevronRight, Clock, Gamepad2, Loader2, LogOut, Trophy } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  formatGameTime,
  getGamesList,
  getGameStatus,
  getGameStatusColor,
  getGameStatusText,
  sortGamesByRecent,
  type GameInfo,
} from "@/services/games-list-service"
import type { ViewerSessionInfo } from "@/types/viewer-session"

interface GameSelectionProps {
  viewer: ViewerSessionInfo
  onLogout: () => void
  loggingOut: boolean
}

export function GameSelection({ viewer, onLogout, loggingOut }: GameSelectionProps) {
  const router = useRouter()
  const [games, setGames] = useState<GameInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setGames(sortGamesByRecent(await getGamesList()))
    } catch (reason) {
      console.error("Failed to load public games", reason)
      setError("比赛列表暂时不可用，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void loadGames(), 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadGames])

  return (
    <div className="w-full max-w-6xl">
      <Card className="border-2 border-primary/20 shadow-2xl backdrop-blur-sm bg-background/95">
        <CardHeader className="border-b border-primary/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                <Gamepad2 className="w-6 h-6 mr-2 inline-block text-cyan-400" /> 安全观赛
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {viewer.team.name} · {viewer.userName}；仅展示脱敏排名与成功解题动态
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onLogout} disabled={loggingOut}>
              <LogOut className="mr-2 h-4 w-4" />退出
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">加载比赛列表中...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : games.length === 0 ? (
            <Alert>
              <AlertDescription>暂无可观看的比赛</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((game) => {
                const status = getGameStatus(game)
                return (
                  <Card
                    key={game.id}
                    role="link"
                    tabIndex={0}
                    className={`cursor-pointer transition-all duration-200 hover:brightness-110 hover:shadow-xl border-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                      status === "active"
                        ? "border-green-500/50 bg-green-500/5 hover:border-green-500"
                        : status === "upcoming"
                          ? "border-yellow-500/50 bg-yellow-500/5 hover:border-yellow-500"
                          : "border-gray-500/50 bg-gray-500/5 hover:border-gray-500"
                    }`}
                    onClick={() => router.push(`/scoreboard/${game.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        router.push(`/scoreboard/${game.id}`)
                      }
                    }}
                  >
                    {game.poster && (
                      <div className="h-32 overflow-hidden rounded-t-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={game.poster}
                          alt={game.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2 flex-1">{game.title}</CardTitle>
                        <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                      </div>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getGameStatusColor(game)} w-fit`}>
                        {getGameStatusText(game)}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {game.summary && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{game.summary}</p>}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>开始：{formatGameTime(game.start)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3" />
                          <span>结束：{formatGameTime(game.end)}</span>
                        </div>
                        {game.limit > 0 && (
                          <div className="flex items-center gap-2">
                            <Trophy className="h-3 w-3" />
                            <span>队伍限制：{game.limit}人</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
