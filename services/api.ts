import type { PublicGameSnapshot } from "@/types/public-api"

export class ViewerApiError extends Error {
  constructor(public readonly status: number) {
    super(`Viewer API request failed: ${status}`)
  }
}

export async function getPublicGameSnapshot(gameId: string, signal?: AbortSignal): Promise<PublicGameSnapshot> {
  const response = await fetch(`/api/public/games/${encodeURIComponent(gameId)}/snapshot`, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new ViewerApiError(response.status)
  }
  return response.json() as Promise<PublicGameSnapshot>
}
