import {
  clearViewerSessionCookie,
  readViewerSessionId,
  viewerSessionInfo,
  viewerSessions,
} from "@/lib/viewer-session.server"

export async function GET(request: Request) {
  const session = viewerSessions.get(readViewerSessionId(request))
  if (!session) {
    return Response.json(
      { authenticated: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": clearViewerSessionCookie(),
        },
      },
    )
  }

  return Response.json(viewerSessionInfo(session), {
    headers: { "Cache-Control": "no-store" },
  })
}
