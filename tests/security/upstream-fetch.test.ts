import { afterEach, describe, expect, it, vi } from "vitest"

import { getPublicGameSnapshot, getPublicPoster } from "@/lib/gzctf-public.server"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("GZCTF upstream requests", () => {
  it("uses unauthenticated GET requests and never forwards browser headers", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      const body = url.endsWith("/api/game")
        ? {
            data: [{ id: 991, title: "Public", summary: "", poster: null, limit: 0, start: 1, end: 2 }],
          }
        : {
            updateTimeUtc: 1,
            items: [],
            challenges: {},
          }
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const snapshot = await getPublicGameSnapshot(991)
    expect(snapshot?.game.id).toBe(991)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await expect(getPublicGameSnapshot(992)).resolves.toBeNull()
    await expect(getPublicPoster("b".repeat(64))).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.method).toBe("GET")
      expect(init?.headers).toEqual({ Accept: "application/json" })
      expect(JSON.stringify(init)).not.toMatch(/cookie|authorization|token/i)
    }
  })
})
