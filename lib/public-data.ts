import { z } from "zod"

import type { EventsResponse } from "@/types/events"
import type { PublicGame } from "@/types/game"
import {
  CHALLENGE_CATEGORIES,
  type BloodType,
  type ChallengeCategory,
  type ChallengeInfo,
  type ScoreboardResponse,
  type SolvedChallenge,
  type TeamInfo,
} from "@/types/scoreboard"

const MAX_GAMES = 200
const MAX_TEAMS = 2_000
const MAX_CHALLENGES_PER_CATEGORY = 1_000
const MAX_SOLVES_PER_TEAM = 2_000
const MAX_PUBLIC_EVENTS = 500
const POSTER_PATH = /^\/assets\/([a-f0-9]{64})\/poster$/i

const gameSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string().optional().default(""),
  poster: z.string().nullable().optional().default(null),
  limit: z.number().int().nonnegative().optional().default(0),
  start: z.number().finite(),
  end: z.number().finite(),
})

const scoreboardEnvelopeSchema = z.object({
  updateTimeUtc: z.number().finite().optional().default(0),
  items: z.array(z.unknown()),
  challenges: z.record(z.array(z.unknown())),
})

const challengeSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  category: z.string().optional(),
  score: z.number().finite(),
  solved: z.number().int().nonnegative(),
})

const solvedChallengeSchema = z.object({
  id: z.number().int().positive(),
  score: z.number().finite(),
  type: z.string().optional().default("Normal"),
  time: z.number().finite(),
})

const teamSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  score: z.number().finite(),
  rank: z.number().int().positive(),
  solvedChallenges: z.array(z.unknown()).optional().default([]),
})

const categorySet = new Set<string>(CHALLENGE_CATEGORIES)
const bloodTypeSet = new Set<string>([
  "Unaccepted",
  "FirstBlood",
  "SecondBlood",
  "ThirdBlood",
  "Normal",
])

function cleanText(value: string, maxLength: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength)
}

function normalizeCategory(value: string | undefined): ChallengeCategory | null {
  return value && categorySet.has(value) ? (value as ChallengeCategory) : null
}

function normalizeBloodType(value: string): BloodType {
  return bloodTypeSet.has(value) ? (value as BloodType) : "Normal"
}

function emptyChallenges(): Record<ChallengeCategory, ChallengeInfo[]> {
  const challenges = {} as Record<ChallengeCategory, ChallengeInfo[]>
  for (const category of CHALLENGE_CATEGORIES) challenges[category] = []
  return challenges
}

export function parsePublicGameId(value: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null
  const gameId = Number(value)
  return Number.isSafeInteger(gameId) ? gameId : null
}

export function publicPosterUrl(value: string | null): string | null {
  if (!value) return null
  const match = POSTER_PATH.exec(value)
  return match ? `/api/public/posters/${match[1].toLowerCase()}` : null
}

export function isPublicPosterAsset(assetId: string, games: PublicGame[]): boolean {
  const publicUrl = `/api/public/posters/${assetId}`
  return games.some((game) => game.poster === publicUrl)
}

export function sanitizePublicGames(input: unknown): PublicGame[] {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(input)
  const rawGames = envelope.success ? envelope.data.data : Array.isArray(input) ? input : []

  return rawGames.slice(0, MAX_GAMES).flatMap((rawGame) => {
    const parsed = gameSchema.safeParse(rawGame)
    if (!parsed.success) return []

    return [
      {
        id: parsed.data.id,
        title: cleanText(parsed.data.title, 200),
        summary: cleanText(parsed.data.summary, 1_000),
        poster: publicPosterUrl(parsed.data.poster),
        limit: parsed.data.limit,
        start: parsed.data.start,
        end: parsed.data.end,
      },
    ]
  })
}

export function sanitizePublicScoreboard(input: unknown): ScoreboardResponse {
  const parsed = scoreboardEnvelopeSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error("Invalid public scoreboard response")
  }

  const challenges = emptyChallenges()
  const challengeById = new Map<number, ChallengeInfo>()

  for (const [rawCategory, rawChallenges] of Object.entries(parsed.data.challenges)) {
    const outerCategory = normalizeCategory(rawCategory)
    for (const rawChallenge of rawChallenges.slice(0, MAX_CHALLENGES_PER_CATEGORY)) {
      const challenge = challengeSchema.safeParse(rawChallenge)
      if (!challenge.success) continue

      const category = normalizeCategory(challenge.data.category) ?? outerCategory
      if (!category) continue

      const safeChallenge: ChallengeInfo = {
        id: challenge.data.id,
        title: cleanText(challenge.data.title, 200),
        category,
        score: Math.max(0, challenge.data.score),
        solved: challenge.data.solved,
      }
      challenges[category].push(safeChallenge)
      challengeById.set(safeChallenge.id, safeChallenge)
    }
  }

  const items: TeamInfo[] = parsed.data.items.slice(0, MAX_TEAMS).flatMap((rawTeam) => {
    const team = teamSchema.safeParse(rawTeam)
    if (!team.success) return []

    const solvedChallenges: SolvedChallenge[] = team.data.solvedChallenges
      .slice(0, MAX_SOLVES_PER_TEAM)
      .flatMap((rawSolve) => {
        const solve = solvedChallengeSchema.safeParse(rawSolve)
        if (!solve.success || !challengeById.has(solve.data.id)) return []
        return [
          {
            id: solve.data.id,
            score: Math.max(0, solve.data.score),
            type: normalizeBloodType(solve.data.type),
            time: solve.data.time,
          },
        ]
      })

    return [
      {
        id: team.data.id,
        name: cleanText(team.data.name, 200),
        score: Math.max(0, team.data.score),
        rank: team.data.rank,
        solvedChallenges,
        solvedCount: solvedChallenges.length,
      },
    ]
  })

  return {
    updateTimeUtc: parsed.data.updateTimeUtc,
    items,
    challenges,
    challengeCount: challengeById.size,
  }
}

export function derivePublicEvents(scoreboard: ScoreboardResponse): EventsResponse {
  const challengeById = new Map<number, ChallengeInfo>()
  for (const challenges of Object.values(scoreboard.challenges)) {
    for (const challenge of challenges) challengeById.set(challenge.id, challenge)
  }

  return scoreboard.items
    .flatMap((team) =>
      team.solvedChallenges.flatMap((solve) => {
        const challenge = challengeById.get(solve.id)
        if (!challenge) return []
        return [
          {
            type: "Solve" as const,
            teamId: team.id,
            team: team.name,
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            challengeCategory: challenge.category,
            score: solve.score,
            bloodType: solve.type,
            time: solve.time,
          },
        ]
      }),
    )
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_PUBLIC_EVENTS)
}
