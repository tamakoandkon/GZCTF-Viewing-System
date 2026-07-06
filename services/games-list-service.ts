/**
 * 游戏列表服务
 */
import { authenticatedFetch } from "./auth-service"

const BASE_URL = ''

// 导出BASE_URL供其他组件使用
export { BASE_URL }

export interface GameInfo {
  id: number
  title: string
  summary: string
  poster: string | null
  limit: number
  start: number // 时间戳（毫秒）
  end: number   // 时间戳（毫秒）
}

// API返回的原始响应格式
export interface GamesApiResponse {
  data: GameInfo[]
  length: number
  total: number
}

export interface GamesListResponse extends Array<GameInfo> {}

/**
 * 获取游戏列表
 */
export async function getGamesList(): Promise<GamesListResponse> {
  const response = await authenticatedFetch(`${BASE_URL}/api/game`)

  if (!response.ok) {
    throw new Error(`Failed to fetch games list: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  
  // 处理API返回的格式：{data: [...], length: 3, total: 3}
  if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
    return result.data as GamesListResponse
  }
  
  // 如果API直接返回数组（兼容性处理）
  if (Array.isArray(result)) {
    return result as GamesListResponse
  }
  
  // 如果格式不对，返回空数组
  console.warn('Unexpected games list response format:', result)
  return [] as GamesListResponse
}

/**
 * 获取正在进行的游戏
 */
export function getActiveGames(games: GamesListResponse): GameInfo[] {
  const now = Date.now()
  return games.filter(game => game.start <= now && game.end >= now)
}

/**
 * 获取即将开始的游戏
 */
export function getUpcomingGames(games: GamesListResponse): GameInfo[] {
  const now = Date.now()
  return games.filter(game => game.start > now)
}

/**
 * 获取已结束的游戏
 */
export function getEndedGames(games: GamesListResponse): GameInfo[] {
  const now = Date.now()
  return games.filter(game => game.end < now)
}

/**
 * 按开始时间排序（最近的在前）
 */
export function sortGamesByRecent(games: GamesListResponse): GamesListResponse {
  return [...games].sort((a, b) => b.start - a.start)
}

/**
 * 格式化时间
 */
export function formatGameTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 获取游戏状态
 */
export function getGameStatus(game: GameInfo): 'active' | 'upcoming' | 'ended' {
  const now = Date.now()
  if (game.start <= now && game.end >= now) return 'active'
  if (game.start > now) return 'upcoming'
  return 'ended'
}

/**
 * 获取游戏状态文本
 */
export function getGameStatusText(game: GameInfo): string {
  const status = getGameStatus(game)
  switch (status) {
    case 'active': return '🔥 进行中'
    case 'upcoming': return '⏰ 即将开始'
    case 'ended': return '✅ 已结束'
  }
}

/**
 * 获取游戏状态颜色类
 */
export function getGameStatusColor(game: GameInfo): string {
  const status = getGameStatus(game)
  switch (status) {
    case 'active': return 'text-green-500 bg-green-500/10 border-green-500'
    case 'upcoming': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500'
    case 'ended': return 'text-gray-500 bg-gray-500/10 border-gray-500'
  }
}

