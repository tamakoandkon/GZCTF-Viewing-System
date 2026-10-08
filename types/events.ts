import type { BloodType, ChallengeCategory } from "@/types/scoreboard"

/**
 * Public events are derived from the public scoreboard. They intentionally do
 * not model raw GZCTF event values, submitted flags, containers, or users.
 */
export interface PublicSolveEvent {
  type: "Solve"
  teamId: number
  team: string
  challengeId: number
  challengeTitle: string
  challengeCategory: ChallengeCategory
  score: number
  bloodType: BloodType
  time: number
}

export type EventsResponse = PublicSolveEvent[]
