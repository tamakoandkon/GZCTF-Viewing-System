import type { PublicGameSnapshot } from "@/types/public-api"

export async function getPublicGameSnapshot(gameId: string): Promise<PublicGameSnapshot> {
  const response = await fetch(`/api/public/games/${encodeURIComponent(gameId)}/snapshot`, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch public scoreboard: ${response.status}`)
  }
  return response.json() as Promise<PublicGameSnapshot>
}
