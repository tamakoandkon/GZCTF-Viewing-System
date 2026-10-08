import { describe, expect, it } from "vitest"

import {
  derivePublicEvents,
  isPublicPosterAsset,
  parsePublicGameId,
  publicPosterUrl,
  sanitizePublicGames,
  sanitizePublicScoreboard,
} from "@/lib/public-data"

const SECRET_FLAG = "flag{must-never-reach-the-browser}"

describe("public data boundary", () => {
  it("accepts only canonical positive game IDs", () => {
    expect(parsePublicGameId("1")).toBe(1)
    expect(parsePublicGameId("0001")).toBeNull()
    expect(parsePublicGameId("1/details")).toBeNull()
    expect(parsePublicGameId("-1")).toBeNull()
    expect(parsePublicGameId("1?admin=true")).toBeNull()
  })

  it("rewrites only canonical poster paths", () => {
    const assetId = "a".repeat(64)
    expect(publicPosterUrl(`/assets/${assetId}/poster`)).toBe(`/api/public/posters/${assetId}`)
    expect(publicPosterUrl("https://attacker.example/image.png")).toBeNull()
    expect(publicPosterUrl(`/assets/${assetId}/../../api/account`)).toBeNull()

    const games = sanitizePublicGames({
      data: [{ id: 1, title: "Public", poster: `/assets/${assetId}/poster`, start: 1, end: 2 }],
    })
    expect(isPublicPosterAsset(assetId, games)).toBe(true)
    expect(isPublicPosterAsset("b".repeat(64), games)).toBe(false)
  })

  it("rebuilds game-list items from an explicit allowlist", () => {
    const result = sanitizePublicGames({
      data: [
        {
          id: 7,
          title: "Public CTF",
          summary: "Watch safely",
          poster: `/assets/${"b".repeat(64)}/poster`,
          limit: 4,
          start: 100,
          end: 200,
          content: SECRET_FLAG,
          inviteCode: "private",
        },
      ],
    })

    expect(result).toEqual([
      {
        id: 7,
        title: "Public CTF",
        summary: "Watch safely",
        poster: `/api/public/posters/${"b".repeat(64)}`,
        limit: 4,
        start: 100,
        end: 200,
      },
    ])
    expect(JSON.stringify(result)).not.toContain(SECRET_FLAG)
    expect(JSON.stringify(result)).not.toContain("inviteCode")
  })

  it("drops flags, raw values, users, bloods, challenge content, and attachments recursively", () => {
    const scoreboard = sanitizePublicScoreboard({
      updateTimeUtc: 123,
      flag: SECRET_FLAG,
      items: [
        {
          id: 10,
          name: "Blue Team",
          bio: SECRET_FLAG,
          avatar: `https://example.invalid/${SECRET_FLAG}`,
          score: 500,
          rank: 1,
          solvedCount: 99,
          solvedChallenges: [
            {
              id: 20,
              score: 500,
              type: "FirstBlood",
              userName: SECRET_FLAG,
              flag: SECRET_FLAG,
              values: ["Accepted", SECRET_FLAG, "Safe Challenge"],
              time: 456,
            },
          ],
        },
      ],
      challenges: {
        Web: [
          {
            id: 20,
            title: "Safe Challenge",
            category: "Web",
            score: 500,
            solved: 1,
            bloods: [{ name: SECRET_FLAG }],
            content: SECRET_FLAG,
            hints: [{ content: SECRET_FLAG }],
            attachments: [{ url: SECRET_FLAG }],
            flag: SECRET_FLAG,
          },
        ],
      },
    })

    expect(scoreboard.items[0]).toEqual({
      id: 10,
      name: "Blue Team",
      score: 500,
      rank: 1,
      solvedCount: 1,
      solvedChallenges: [{ id: 20, score: 500, type: "FirstBlood", time: 456 }],
    })
    expect(scoreboard.challenges.Web[0]).toEqual({
      id: 20,
      title: "Safe Challenge",
      category: "Web",
      score: 500,
      solved: 1,
    })

    const events = derivePublicEvents(scoreboard)
    expect(events).toEqual([
      {
        type: "Solve",
        teamId: 10,
        team: "Blue Team",
        challengeId: 20,
        challengeTitle: "Safe Challenge",
        challengeCategory: "Web",
        score: 500,
        bloodType: "FirstBlood",
        time: 456,
      },
    ])

    const serialized = JSON.stringify({ scoreboard, events })
    expect(serialized).not.toContain(SECRET_FLAG)
    for (const forbiddenKey of ["flag", "values", "userName", "bio", "avatar", "bloods", "content", "hints", "attachments"]) {
      expect(serialized).not.toContain(`"${forbiddenKey}"`)
    }
  })
})
