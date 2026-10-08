import { getPublicGames } from "@/lib/gzctf-public.server"
import {
  clearViewerSessionCookie,
  readViewerSessionId,
  viewerSessions,
} from "@/lib/viewer-session.server"

export async function GET(request: Request) {
  const session = viewerSessions.get(readViewerSessionId(request))
  if (!session) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store", "Set-Cookie": clearViewerSessionCookie() } },
    )
  }

  try {
    const games = await getPublicGames()
    return Response.json(games, {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Failed to load the public game list", error)
    return Response.json({ error: "Public game data is temporarily unavailable" }, { status: 502 })
  }
}
