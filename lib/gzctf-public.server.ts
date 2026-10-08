import type { PublicGame } from "@/types/game"
import type { PublicGameSnapshot } from "@/types/public-api"
import {
  derivePublicEvents,
  isPublicPosterAsset,
  sanitizePublicGames,
  sanitizePublicScoreboard,
} from "@/lib/public-data"
import { detectSafeImageContentType } from "@/lib/image-signature"

const DEFAULT_GZCTF_ORIGIN = "http://127.0.0.1:36306"
const JSON_LIMIT_BYTES = 5 * 1024 * 1024
const POSTER_LIMIT_BYTES = 5 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 5_000

interface CacheEntry<T> {
  expiresAt: number
  promise: Promise<T>
}

const responseCache = new Map<string, CacheEntry<unknown>>()

export function gzctfOrigin(): string {
  const origin = new URL(process.env.GZCTF_API_ORIGIN || DEFAULT_GZCTF_ORIGIN)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
    throw new Error("Invalid GZCTF_API_ORIGIN")
  }
  return origin.origin
}

export function gzctfUpstreamUrl(pathname: string): URL {
  return new URL(pathname, `${gzctfOrigin()}/`)
}

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const current = responseCache.get(key) as CacheEntry<T> | undefined
  if (current && current.expiresAt > now) return current.promise

  const promise = loader()
  responseCache.set(key, { expiresAt: now + CACHE_TTL_MS, promise })
  try {
    return await promise
  } catch (error) {
    responseCache.delete(key)
    throw error
  }
}

async function fetchJson(pathname: string): Promise<unknown> {
  const response = await fetch(gzctfUpstreamUrl(pathname), {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`GZCTF request failed with status ${response.status}`)
  const declaredLength = Number(response.headers.get("content-length") || 0)
  if (declaredLength > JSON_LIMIT_BYTES) throw new Error("GZCTF response is too large")

  const body = await response.text()
  if (new TextEncoder().encode(body).byteLength > JSON_LIMIT_BYTES) {
    throw new Error("GZCTF response is too large")
  }
  return JSON.parse(body) as unknown
}

export async function getPublicGames(): Promise<PublicGame[]> {
  return cached("games", async () => sanitizePublicGames(await fetchJson("/api/game")))
}

export async function getPublicGameSnapshot(gameId: number): Promise<PublicGameSnapshot | null> {
  return cached(`snapshot:${gameId}`, async () => {
    const games = await getPublicGames()
    const game = games.find((candidate) => candidate.id === gameId)
    if (!game) return null

    const rawScoreboard = await fetchJson(`/api/game/${gameId}/scoreboard`)
    const scoreboard = sanitizePublicScoreboard(rawScoreboard)
    return { game, scoreboard, events: derivePublicEvents(scoreboard) }
  })
}

export async function getPublicPoster(assetId: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!isPublicPosterAsset(assetId, await getPublicGames())) return null

  const response = await fetch(gzctfUpstreamUrl(`/assets/${assetId}/poster`), {
    method: "GET",
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GZCTF poster request failed with status ${response.status}`)

  const declaredLength = Number(response.headers.get("content-length") || 0)
  if (declaredLength > POSTER_LIMIT_BYTES) throw new Error("GZCTF poster is too large")

  const body = await response.arrayBuffer()
  if (body.byteLength > POSTER_LIMIT_BYTES) throw new Error("GZCTF poster is too large")
  const contentType = detectSafeImageContentType(body)
  if (!contentType) throw new Error("Invalid GZCTF poster response")
  return { body, contentType }
}
