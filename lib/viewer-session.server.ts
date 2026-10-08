import { randomBytes } from "node:crypto"

import type { ViewerTeam } from "@/types/viewer-session"

export const VIEWER_SESSION_COOKIE = "gzctf_viewer_session"
export const VIEWER_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

const DEFAULT_SESSION_TTL_MS = VIEWER_SESSION_MAX_AGE_SECONDS * 1_000
const DEFAULT_LEASE_TTL_MS = 90_000
const DEFAULT_SNAPSHOT_INTERVAL_MS = 10_000

export interface ViewerSessionInput {
  userId: string
  userName: string
  team: ViewerTeam
  upstreamCookie: string
}

export interface ViewerSessionRecord extends ViewerSessionInput {
  id: string
  expiresAt: number
  gameAccess: Map<number, number>
  lastSnapshotAt: number | null
}

interface TeamLease {
  sessionId: string
  expiresAt: number
}

interface RegistryOptions {
  now?: () => number
  sessionTtlMs?: number
  leaseTtlMs?: number
  snapshotIntervalMs?: number
}

export class ViewerSessionRegistry {
  private readonly sessions = new Map<string, ViewerSessionRecord>()
  private readonly leases = new Map<number, TeamLease>()
  private readonly now: () => number
  private readonly sessionTtlMs: number
  private readonly leaseTtlMs: number
  private readonly snapshotIntervalMs: number

  constructor(options: RegistryOptions = {}) {
    this.now = options.now ?? Date.now
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS
    this.leaseTtlMs = options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS
    this.snapshotIntervalMs = options.snapshotIntervalMs ?? DEFAULT_SNAPSHOT_INTERVAL_MS
  }

  create(input: ViewerSessionInput, replacedSessionId?: string | null): ViewerSessionRecord | null {
    const now = this.now()
    this.cleanup(now)

    const currentLease = this.leases.get(input.team.id)
    if (currentLease && currentLease.sessionId !== replacedSessionId) return null

    if (replacedSessionId) this.destroy(replacedSessionId)
    for (const [sessionId, session] of this.sessions) {
      if (session.team.id === input.team.id) this.destroy(sessionId)
    }

    const id = randomBytes(32).toString("base64url")
    const session: ViewerSessionRecord = {
      ...input,
      id,
      expiresAt: now + this.sessionTtlMs,
      gameAccess: new Map(),
      lastSnapshotAt: null,
    }
    this.sessions.set(id, session)
    this.leases.set(input.team.id, { sessionId: id, expiresAt: now + this.leaseTtlMs })
    return session
  }

  get(id: string | null): ViewerSessionRecord | null {
    if (!id) return null
    const now = this.now()
    this.cleanup(now)
    const session = this.sessions.get(id)
    if (!session || session.expiresAt <= now) {
      if (session) this.destroy(id)
      return null
    }

    const lease = this.leases.get(session.team.id)
    if (lease && lease.expiresAt > now && lease.sessionId !== id) {
      this.sessions.delete(id)
      return null
    }

    session.expiresAt = now + this.sessionTtlMs
    this.leases.set(session.team.id, { sessionId: id, expiresAt: now + this.leaseTtlMs })
    return session
  }

  destroy(id: string | null): void {
    if (!id) return
    const session = this.sessions.get(id)
    this.sessions.delete(id)
    if (session && this.leases.get(session.team.id)?.sessionId === id) {
      this.leases.delete(session.team.id)
    }
  }

  hasGameAccess(session: ViewerSessionRecord, gameId: number): boolean {
    return (session.gameAccess.get(gameId) ?? 0) > this.now()
  }

  grantGameAccess(session: ViewerSessionRecord, gameId: number, ttlMs = 5 * 60_000): void {
    session.gameAccess.set(gameId, this.now() + ttlMs)
  }

  consumeSnapshotQuota(session: ViewerSessionRecord): number {
    const now = this.now()
    const lastRequest = session.lastSnapshotAt
    if (lastRequest === null) {
      session.lastSnapshotAt = now
      return 0
    }
    const retryAfterMs = lastRequest + this.snapshotIntervalMs - now
    if (retryAfterMs > 0) return Math.ceil(retryAfterMs / 1_000)
    session.lastSnapshotAt = now
    return 0
  }

  private cleanup(now: number): void {
    for (const [teamId, lease] of this.leases) {
      if (lease.expiresAt <= now) this.leases.delete(teamId)
    }
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.destroy(id)
    }
  }
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 10_000,
  ) {}

  consume(key: string): number {
    const now = this.now()
    const current = this.entries.get(key)
    if (!current || current.resetAt <= now) {
      if (!current && this.entries.size >= this.maxEntries) {
        for (const [entryKey, entry] of this.entries) {
          if (entry.resetAt <= now) this.entries.delete(entryKey)
        }
        if (this.entries.size >= this.maxEntries) return Math.ceil(this.windowMs / 1_000)
      }
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs })
      return 0
    }
    if (current.count >= this.limit) return Math.ceil((current.resetAt - now) / 1_000)
    current.count += 1
    return 0
  }

  clear(key: string): void {
    this.entries.delete(key)
  }
}

interface ViewerGlobalState {
  gzctfViewerSessions?: ViewerSessionRegistry
  gzctfViewerIpLimiter?: FixedWindowRateLimiter
  gzctfViewerAccountLimiter?: FixedWindowRateLimiter
}

const viewerGlobal = globalThis as typeof globalThis & ViewerGlobalState

export const viewerSessions =
  viewerGlobal.gzctfViewerSessions ?? (viewerGlobal.gzctfViewerSessions = new ViewerSessionRegistry())
export const loginIpLimiter =
  viewerGlobal.gzctfViewerIpLimiter ??
  (viewerGlobal.gzctfViewerIpLimiter = new FixedWindowRateLimiter(100, 10 * 60_000))
export const loginAccountLimiter =
  viewerGlobal.gzctfViewerAccountLimiter ??
  (viewerGlobal.gzctfViewerAccountLimiter = new FixedWindowRateLimiter(10, 10 * 60_000))

export function readViewerSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie")
  if (!cookie) return null
  for (const item of cookie.split(";")) {
    const [name, ...value] = item.trim().split("=")
    if (name === VIEWER_SESSION_COOKIE) {
      const sessionId = value.join("=")
      return /^[A-Za-z0-9_-]{43}$/.test(sessionId) ? sessionId : null
    }
  }
  return null
}

export function viewerSessionCookie(sessionId: string, secure = process.env.NODE_ENV === "production"): string {
  return [
    `${VIEWER_SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${VIEWER_SESSION_MAX_AGE_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ")
}

export function clearViewerSessionCookie(secure = process.env.NODE_ENV === "production"): string {
  return [
    `${VIEWER_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ")
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false

  try {
    const suppliedOrigin = new URL(origin).origin
    const allowedOrigins = new Set([new URL(request.url).origin])
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    const host = forwardedHost || request.headers.get("host")?.trim()
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",", 1)[0]
      ?.trim()
      .toLowerCase()
    const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1)

    if (host && (protocol === "http" || protocol === "https")) {
      const externalUrl = new URL(`${protocol}://${host}`)
      const canonicalHost = host.toLowerCase()
      if (
        externalUrl.host.toLowerCase() === canonicalHost &&
        externalUrl.pathname === "/" &&
        !externalUrl.username &&
        !externalUrl.password
      ) {
        allowedOrigins.add(externalUrl.origin)
      }
    }

    return allowedOrigins.has(suppliedOrigin)
  } catch {
    return false
  }
}

export function viewerSessionInfo(session: ViewerSessionRecord) {
  return {
    authenticated: true as const,
    userName: session.userName,
    team: session.team,
  }
}
