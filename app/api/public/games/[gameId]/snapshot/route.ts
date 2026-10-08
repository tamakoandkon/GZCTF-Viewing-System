import { getPublicGameSnapshot } from "@/lib/gzctf-public.server"
import { parsePublicGameId } from "@/lib/public-data"

interface RouteParams {
  params: Promise<{ gameId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const gameId = parsePublicGameId((await params).gameId)
  if (gameId === null) {
    return Response.json({ error: "Invalid game ID" }, { status: 400 })
  }

  try {
    const snapshot = await getPublicGameSnapshot(gameId)
    if (!snapshot) return Response.json({ error: "Game not found" }, { status: 404 })

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Failed to load a public game snapshot", error)
    return Response.json({ error: "Public scoreboard data is temporarily unavailable" }, { status: 502 })
  }
}
