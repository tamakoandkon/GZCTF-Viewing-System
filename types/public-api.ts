import type { EventsResponse } from "@/types/events"
import type { PublicGame } from "@/types/game"
import type { ScoreboardResponse } from "@/types/scoreboard"

export interface PublicGameSnapshot {
  game: PublicGame
  scoreboard: ScoreboardResponse
  events: EventsResponse
}
