import { describe, expect, it } from "vitest"

import {
  isSameOriginRequest,
  readViewerSessionId,
  ViewerSessionRegistry,
  viewerSessionCookie,
} from "@/lib/viewer-session.server"

const input = {
  userId: "8a48fca1-cffa-44ea-85e6-85a86969c20d",
  userName: "viewer-one",
  team: { id: 7, name: "Blue Team" },
  upstreamCookie: ".AspNetCore.Identity.Application=upstream-secret",
}

describe("viewer session registry", () => {
  it("allows only one active session per team and releases stale leases", () => {
    let now = 1_000
    const registry = new ViewerSessionRegistry({ now: () => now, leaseTtlMs: 90_000 })
    const first = registry.create(input)
    expect(first).not.toBeNull()
    expect(registry.create({ ...input, userName: "viewer-two" })).toBeNull()

    now += 90_001
    const second = registry.create({ ...input, userName: "viewer-two" })
    expect(second).not.toBeNull()
    expect(registry.get(first!.id)).toBeNull()
    expect(registry.get(second!.id)?.userName).toBe("viewer-two")
  })

  it("rate-limits scoreboard snapshots across games for the whole session", () => {
    let now = 1_000
    const registry = new ViewerSessionRegistry({ now: () => now, snapshotIntervalMs: 10_000 })
    const session = registry.create(input)!
    expect(registry.consumeSnapshotQuota(session)).toBe(0)
    expect(registry.consumeSnapshotQuota(session)).toBe(10)
    now += 10_001
    expect(registry.consumeSnapshotQuota(session)).toBe(0)
  })
})

describe("viewer session cookie boundary", () => {
  it("creates an HttpOnly SameSite cookie and parses only canonical IDs", () => {
    const registry = new ViewerSessionRegistry()
    const session = registry.create(input)!
    const cookie = viewerSessionCookie(session.id, true)
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=Strict")
    expect(cookie).toContain("Secure")
    expect(cookie).not.toContain("upstream-secret")

    const request = new Request("https://viewer.example/api/viewer/session", {
      headers: { Cookie: cookie },
    })
    expect(readViewerSessionId(request)).toBe(session.id)
  })

  it("rejects cross-origin state-changing requests", () => {
    expect(
      isSameOriginRequest(
        new Request("https://viewer.example/api/viewer/session/login", {
          headers: { Origin: "https://viewer.example" },
        }),
      ),
    ).toBe(true)
    expect(
      isSameOriginRequest(
        new Request("https://viewer.example/api/viewer/session/login", {
          headers: { Origin: "https://attacker.example" },
        }),
      ),
    ).toBe(false)
  })

  it("uses reverse-proxy origin headers when Next normalizes the request URL", () => {
    expect(
      isSameOriginRequest(
        new Request("http://localhost:3000/api/viewer/session/login", {
          headers: {
            Host: "viewer.example",
            Origin: "https://viewer.example",
            "X-Forwarded-Proto": "https",
          },
        }),
      ),
    ).toBe(true)

    expect(
      isSameOriginRequest(
        new Request("http://localhost:3000/api/viewer/session/login", {
          headers: {
            Host: "viewer.example",
            Origin: "https://attacker.example",
            "X-Forwarded-Proto": "https",
          },
        }),
      ),
    ).toBe(false)
  })
})
