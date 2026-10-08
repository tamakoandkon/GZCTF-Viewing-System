import { logoutUpstream } from "@/lib/gzctf-auth.server"
import {
  clearViewerSessionCookie,
  isSameOriginRequest,
  readViewerSessionId,
  viewerSessions,
} from "@/lib/viewer-session.server"

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 })
  }

  const sessionId = readViewerSessionId(request)
  const session = viewerSessions.get(sessionId)
  viewerSessions.destroy(sessionId)
  if (session) await logoutUpstream(session.upstreamCookie)

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": clearViewerSessionCookie(),
    },
  })
}
