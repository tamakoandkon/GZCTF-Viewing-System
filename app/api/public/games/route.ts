import { getPublicGames } from "@/lib/gzctf-public.server"

export async function GET() {
  try {
    const games = await getPublicGames()
    return Response.json(games, {
      headers: {
        "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Failed to load the public game list", error)
    return Response.json({ error: "Public game data is temporarily unavailable" }, { status: 502 })
  }
}
