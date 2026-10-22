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

export function sortGamesForViewing(games: GamesListResponse): GamesListResponse {
  const now = Date.now()
  const priority = { active: 0, upcoming: 1, ended: 2 }
  return [...games].sort((a, b) => {
    const statusA = getGameStatus(a, now)
    const statusB = getGameStatus(b, now)
    if (statusA !== statusB) return priority[statusA] - priority[statusB]
    if (statusA === "active") return a.end - b.end
    if (statusA === "upcoming") return a.start - b.start
    return b.end - a.end
  })
}

export function formatGameTime(timestamp: number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return "时间待定"
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getGameStatus(game: GameInfo, now = Date.now()): "active" | "upcoming" | "ended" {
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
