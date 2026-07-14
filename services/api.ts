import type { ScoreboardResponse } from "@/types/scoreboard"
import type { EventsResponse } from "@/types/events"
import type { GameDetail } from "@/types/game"
import type { GameDetails } from "@/types/challenge"
import { authenticatedFetch } from "./auth-service"

export async function getScoreboard(gameId: string): Promise<ScoreboardResponse> {
  return authenticatedFetch(`/api/game/${gameId}/scoreboard`).then(r => r.json())
}
export async function getEvents(gameId: string): Promise<EventsResponse> {
  return authenticatedFetch(`/api/game/${gameId}/events?hideContainer=true&count=100&skip=0`).then(r => r.json()).then(data => Array.isArray(data) ? data : (data?.data ?? data?.items ?? []))
}
export async function getGameDetail(gameId: string): Promise<GameDetail> {
  return authenticatedFetch(`/api/game/${gameId}`).then(r => r.json())
}
export async function getGameDetails(gameId: string): Promise<GameDetails> {
  return authenticatedFetch(`/api/game/${gameId}/details`).then(r => r.json())
}
