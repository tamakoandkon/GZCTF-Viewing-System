import { getPublicPoster } from "@/lib/gzctf-public.server"

const ASSET_ID = /^[a-f0-9]{64}$/

interface RouteParams {
  params: Promise<{ assetId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const assetId = (await params).assetId.toLowerCase()
  if (!ASSET_ID.test(assetId)) return new Response(null, { status: 404 })

  try {
    const poster = await getPublicPoster(assetId)
    if (!poster) return new Response(null, { status: 404 })

    return new Response(poster.body, {
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Type": poster.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Failed to load a public game poster", error)
    return new Response(null, { status: 502 })
  }
}
