import { afterEach, describe, expect, it, vi } from "vitest"

import { GET as getGames } from "@/app/api/public/games/route"
import { GET as getSnapshot } from "@/app/api/public/games/[gameId]/snapshot/route"
import { viewerSessions } from "@/lib/viewer-session.server"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("authenticated public API", () => {
  it("rejects unauthenticated data requests before contacting GZCTF", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const response = await getGames(new Request("https://viewer.test/api/public/games"))
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses the server-held cookie only for participation and sanitizes the snapshot", async () => {
    const upstreamCookie = ".AspNetCore.Identity.Application=server-only"
    const session = viewerSessions.create({
      userId: "34a543c8-ae28-471a-8a77-3da4080229ee",
      userName: "alice",
      team: { id: 702, name: "Blue Team" },
      upstreamCookie,
    })!

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith("/api/game/2")) {
        expect(init?.headers).toEqual({ Accept: "application/json", Cookie: upstreamCookie })
        return Response.json({
          id: 2,
          teamName: "Blue Team",
          status: "Accepted",
          content: "flag{private-game-content}",
        })
      }
      if (url.endsWith("/api/game")) {
        expect(JSON.stringify(init?.headers)).not.toMatch(/cookie|authorization|server-only/i)
        return Response.json({
          data: [{ id: 2, title: "Public CTF", summary: "Watch", poster: null, limit: 4, start: 1, end: 2 }],
        })
      }
      if (url.endsWith("/api/game/2/scoreboard")) {
        expect(JSON.stringify(init?.headers)).not.toMatch(/cookie|authorization|server-only/i)
        return Response.json({
          updateTimeUtc: 1,
          flag: "flag{private-scoreboard-field}",
          items: [],
          challenges: {},
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const response = await getSnapshot(
      new Request("https://viewer.test/api/public/games/2/snapshot", {
        headers: { Cookie: `gzctf_viewer_session=${session.id}` },
      }),
      { params: Promise.resolve({ gameId: "2" }) },
    )

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).not.toMatch(/flag\{|server-only|content|cookie|authorization/i)
    expect(JSON.parse(body)).toMatchObject({
      game: { id: 2, title: "Public CTF" },
      scoreboard: { items: [], challenges: {}, challengeCount: 0 },
      events: [],
    })
    viewerSessions.destroy(session.id)
  })
})
