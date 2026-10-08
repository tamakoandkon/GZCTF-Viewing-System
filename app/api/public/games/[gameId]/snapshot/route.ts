import { getPublicGameSnapshot } from "@/lib/gzctf-public.server"
import { GzctfSessionExpiredError, verifyViewerGameAccess } from "@/lib/gzctf-auth.server"
import { parsePublicGameId } from "@/lib/public-data"
import {
  clearViewerSessionCookie,
  readViewerSessionId,
  viewerSessions,
} from "@/lib/viewer-session.server"

interface RouteParams {
  params: Promise<{ gameId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const gameId = parsePublicGameId((await params).gameId)
  if (gameId === null) {
    return Response.json({ error: "Invalid game ID" }, { status: 400 })
  }

  const sessionId = readViewerSessionId(request)
  const session = viewerSessions.get(sessionId)
  if (!session) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store", "Set-Cookie": clearViewerSessionCookie() } },
    )
  }

  const retryAfter = viewerSessions.consumeSnapshotQuota(session)
  if (retryAfter > 0) {
    return Response.json(
      { error: "Too many snapshot requests" },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) } },
    )
  }

  try {
    if (!viewerSessions.hasGameAccess(session, gameId)) {
      if (!(await verifyViewerGameAccess(session.upstreamCookie, session.team, gameId))) {
        return Response.json(
          { error: "The selected team is not participating in this game" },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        )
      }
      viewerSessions.grantGameAccess(session, gameId)
    }

    const snapshot = await getPublicGameSnapshot(gameId)
    if (!snapshot) return Response.json({ error: "Game not found" }, { status: 404 })

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (error instanceof GzctfSessionExpiredError) {
      viewerSessions.destroy(sessionId)
      return Response.json(
        { error: "Authentication expired" },
        { status: 401, headers: { "Cache-Control": "no-store", "Set-Cookie": clearViewerSessionCookie() } },
      )
    }
    console.error("Failed to load a public game snapshot", error)
    return Response.json({ error: "Public scoreboard data is temporarily unavailable" }, { status: 502 })
  }
}
