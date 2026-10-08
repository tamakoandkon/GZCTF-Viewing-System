/** Public game-list helpers. */
import type { PublicGame } from "@/types/game"

export type GameInfo = PublicGame
export type GamesListResponse = GameInfo[]

export async function getGamesList(): Promise<GamesListResponse> {
  const response = await fetch("/api/public/games", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch public games: ${response.status}`)
  }

  const result: unknown = await response.json()
  return Array.isArray(result) ? (result as GamesListResponse) : []
}

export function getActiveGames(games: GamesListResponse): GameInfo[] {
  const now = Date.now()
  return games.filter((game) => game.start <= now && game.end >= now)
}

export function getUpcomingGames(games: GamesListResponse): GameInfo[] {
  const now = Date.now()
  return games.filter((game) => game.start > now)
}

export function getEndedGames(games: GamesListResponse): GameInfo[] {
  const now = Date.now()
  return games.filter((game) => game.end < now)
}

export function sortGamesByRecent(games: GamesListResponse): GamesListResponse {
  return [...games].sort((a, b) => b.start - a.start)
}

export function formatGameTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getGameStatus(game: GameInfo): "active" | "upcoming" | "ended" {
  const now = Date.now()
  if (game.start <= now && game.end >= now) return "active"
  if (game.start > now) return "upcoming"
  return "ended"
}

export function getGameStatusText(game: GameInfo): string {
  switch (getGameStatus(game)) {
    case "active":
      return "🔥 进行中"
    case "upcoming":
      return "⏰ 即将开始"
    case "ended":
      return "✅ 已结束"
  }
}

export function getGameStatusColor(game: GameInfo): string {
  switch (getGameStatus(game)) {
    case "active":
      return "text-green-500 bg-green-500/10 border-green-500"
    case "upcoming":
      return "text-yellow-500 bg-yellow-500/10 border-yellow-500"
    case "ended":
      return "text-gray-500 bg-gray-500/10 border-gray-500"
  }
}
