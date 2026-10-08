import { afterEach, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/viewer/session/login/route"
import { readViewerSessionId, viewerSessions } from "@/lib/viewer-session.server"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("viewer login route", () => {
  it("rejects oversized login bodies before contacting GZCTF", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const response = await POST(
      new Request("http://viewer.test/api/viewer/session/login", {
        method: "POST",
        headers: { Origin: "http://viewer.test", "Content-Type": "application/json" },
        body: JSON.stringify({ userName: "alice", password: "x".repeat(5_000) }),
      }),
    )

    expect(response.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps the GZCTF cookie server-side and returns only the viewer identity", async () => {
    const upstreamSecret = ".AspNetCore.Identity.Application=never-send-to-browser"
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith("/api/config")) return Response.json({ apiPublicKey: null })
      if (url.endsWith("/api/account/login")) {
        expect(init?.body).toContain('"password":"correct horse"')
        return new Response(null, { headers: { "Set-Cookie": `${upstreamSecret}; Path=/; HttpOnly` } })
      }
      if (url.endsWith("/api/account/profile")) {
        expect(init?.headers).toEqual({ Accept: "application/json", Cookie: upstreamSecret })
        return Response.json({
          userId: "8a48fca1-cffa-44ea-85e6-85a86969c20d",
          userName: "alice",
          email: "private@example.test",
          bio: "private",
        })
      }
      if (url.endsWith("/api/team")) {
        expect(init?.headers).toEqual({ Accept: "application/json", Cookie: upstreamSecret })
        return Response.json([
          { id: 701, name: "Blue Team", members: [{ realName: "private", studentNumber: "private" }] },
        ])
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const response = await POST(
      new Request("http://viewer.test/api/viewer/session/login", {
        method: "POST",
        headers: { Origin: "http://viewer.test", "Content-Type": "application/json", "X-Real-IP": "192.0.2.7" },
        body: JSON.stringify({ userName: "alice", password: "correct horse" }),
      }),
    )

    expect(response.status).toBe(200)
    const bodyText = await response.text()
    expect(JSON.parse(bodyText)).toEqual({
      succeeded: true,
      authenticated: true,
      userName: "alice",
      team: { id: 701, name: "Blue Team" },
    })
    expect(bodyText).not.toMatch(/password|cookie|email|bio|realName|studentNumber|never-send/i)

    const browserCookie = response.headers.get("set-cookie")
    expect(browserCookie).toContain("gzctf_viewer_session=")
    expect(browserCookie).toContain("HttpOnly")
    expect(browserCookie).not.toContain("never-send-to-browser")

    const sessionId = readViewerSessionId(
      new Request("http://viewer.test/", { headers: { Cookie: browserCookie! } }),
    )
    expect(viewerSessions.get(sessionId)?.upstreamCookie).toBe(upstreamSecret)
    viewerSessions.destroy(sessionId)
  })
})
