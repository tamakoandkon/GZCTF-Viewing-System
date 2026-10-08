import { z } from "zod"

import { gzctfUpstreamUrl } from "@/lib/gzctf-public.server"
import type { ViewerSessionInput } from "@/lib/viewer-session.server"
import type { ViewerTeam } from "@/types/viewer-session"

const AUTH_TIMEOUT_MS = 8_000
const AUTH_JSON_LIMIT_BYTES = 1024 * 1024
const MAX_UPSTREAM_COOKIE_BYTES = 32 * 1024

const profileSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string().min(1).max(200).nullable().optional(),
})

const teamSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
})

const gameParticipationSchema = z.object({
  teamName: z.string().min(1).max(200).nullable().optional(),
  status: z.literal("Accepted"),
})

export type GzctfLoginResult =
  | { status: "ok"; session: ViewerSessionInput }
  | { status: "invalid" }
  | { status: "team-required" }
  | { status: "team-selection-required"; teams: ViewerTeam[] }

export class GzctfSessionExpiredError extends Error {}
export class GzctfLoginConfigurationError extends Error {}

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
}

function extractCookieHeader(headers: Headers): string | null {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const values = typeof getSetCookie === "function" ? getSetCookie.call(headers) : []
  if (values.length === 0) {
    const fallback = headers.get("set-cookie")
    if (fallback) values.push(fallback)
  }

  const cookieHeader = values
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter((value): value is string => Boolean(value && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+=[^\r\n;]*$/.test(value)))
    .join("; ")

  if (!cookieHeader || new TextEncoder().encode(cookieHeader).byteLength > MAX_UPSTREAM_COOKIE_BYTES) {
    return null
  }
  return cookieHeader
}

async function readJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") || 0)
  if (declaredLength > AUTH_JSON_LIMIT_BYTES) throw new Error("GZCTF authentication response is too large")
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > AUTH_JSON_LIMIT_BYTES) {
    throw new Error("GZCTF authentication response is too large")
  }
  return JSON.parse(text) as unknown
}

async function authenticatedJson(pathname: string, upstreamCookie: string): Promise<unknown> {
  const response = await fetch(gzctfUpstreamUrl(pathname), {
    method: "GET",
    headers: { Accept: "application/json", Cookie: upstreamCookie },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  })
  if (response.status === 401 || response.status === 403) throw new GzctfSessionExpiredError()
  if (!response.ok) throw new Error(`GZCTF authentication request failed with status ${response.status}`)
  return readJson(response)
}

export async function authenticateViewer(
  userName: string,
  password: string,
  selectedTeamId?: number,
): Promise<GzctfLoginResult> {
  const configResponse = await fetch(gzctfUpstreamUrl("/api/config"), {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  })
  if (!configResponse.ok) throw new Error("Unable to read the GZCTF login configuration")
  const config = z.object({ apiPublicKey: z.string().nullable().optional() }).safeParse(await readJson(configResponse))
  if (!config.success) throw new Error("Invalid GZCTF login configuration")
  if (config.data.apiPublicKey) {
    throw new GzctfLoginConfigurationError("Encrypted GZCTF login is not configured in the viewer")
  }

  const loginResponse = await fetch(gzctfUpstreamUrl("/api/account/login"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ userName, password }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  })
  if (loginResponse.status === 400 || loginResponse.status === 401 || loginResponse.status === 403) {
    return { status: "invalid" }
  }
  if (!loginResponse.ok) throw new Error(`GZCTF login failed with status ${loginResponse.status}`)

  const upstreamCookie = extractCookieHeader(loginResponse.headers)
  if (!upstreamCookie) throw new Error("GZCTF did not issue a usable authentication cookie")

  const [rawProfile, rawTeams] = await Promise.all([
    authenticatedJson("/api/account/profile", upstreamCookie),
    authenticatedJson("/api/team", upstreamCookie),
  ])
  const profile = profileSchema.safeParse(rawProfile)
  const teamList = z.array(z.unknown()).safeParse(rawTeams)
  if (!profile.success || !teamList.success) throw new Error("Invalid GZCTF identity response")

  const teams = teamList.data.flatMap((rawTeam) => {
    const team = teamSchema.safeParse(rawTeam)
    return team.success ? [{ id: team.data.id, name: cleanText(team.data.name) }] : []
  })
  if (teams.length === 0) return { status: "team-required" }

  let team: ViewerTeam | undefined
  if (selectedTeamId !== undefined) team = teams.find((candidate) => candidate.id === selectedTeamId)
  else if (teams.length === 1) team = teams[0]
  if (!team) return { status: "team-selection-required", teams }

  return {
    status: "ok",
    session: {
      userId: profile.data.userId,
      userName: cleanText(profile.data.userName || userName),
      team,
      upstreamCookie,
    },
  }
}

export async function verifyViewerGameAccess(
  upstreamCookie: string,
  team: ViewerTeam,
  gameId: number,
): Promise<boolean> {
  const parsed = gameParticipationSchema.safeParse(
    await authenticatedJson(`/api/game/${gameId}`, upstreamCookie),
  )
  return parsed.success && parsed.data.teamName === team.name
}

export async function logoutUpstream(upstreamCookie: string): Promise<void> {
  try {
    await fetch(gzctfUpstreamUrl("/api/account/logout"), {
      method: "POST",
      headers: { Accept: "application/json", Cookie: upstreamCookie },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    })
  } catch {
    // The local viewer session is invalidated even if GZCTF is unavailable.
  }
}
