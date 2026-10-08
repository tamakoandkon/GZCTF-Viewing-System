import { getPublicPoster } from "@/lib/gzctf-public.server"
import {
  clearViewerSessionCookie,
  readViewerSessionId,
  viewerSessions,
} from "@/lib/viewer-session.server"

const ASSET_ID = /^[a-f0-9]{64}$/

interface RouteParams {
  params: Promise<{ assetId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const assetId = (await params).assetId.toLowerCase()
  if (!ASSET_ID.test(assetId)) return new Response(null, { status: 404 })

  if (!viewerSessions.get(readViewerSessionId(request))) {
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "no-store", "Set-Cookie": clearViewerSessionCookie() },
    })
  }

  try {
    const poster = await getPublicPoster(assetId)
    if (!poster) return new Response(null, { status: 404 })

    return new Response(poster.body, {
      headers: {
        "Cache-Control": "private, max-age=86400, immutable",
        "Content-Type": poster.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Failed to load a public game poster", error)
    return new Response(null, { status: 502 })
  }
}
