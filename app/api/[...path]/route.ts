function denyApiAccess() {
  return Response.json(
    { error: "Not found" },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}

export const GET = denyApiAccess
export const HEAD = denyApiAccess
export const POST = denyApiAccess
export const PUT = denyApiAccess
export const PATCH = denyApiAccess
export const DELETE = denyApiAccess
export const OPTIONS = denyApiAccess
