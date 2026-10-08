import { z } from "zod"

import {
  authenticateViewer,
  GzctfLoginConfigurationError,
} from "@/lib/gzctf-auth.server"
import {
  isSameOriginRequest,
  loginAccountLimiter,
  loginIpLimiter,
  readViewerSessionId,
  viewerSessionCookie,
  viewerSessionInfo,
  viewerSessions,
} from "@/lib/viewer-session.server"
import type { ViewerLoginFailure } from "@/types/viewer-session"

const loginSchema = z.object({
  userName: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(512),
  teamId: z.number().int().positive().optional(),
})
const MAX_LOGIN_BODY_BYTES = 4 * 1024

function failure(body: ViewerLoginFailure, status: number, retryAfter?: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  })
}

function clientKey(request: Request): string {
  const raw =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",", 1)[0] ||
    "unknown"
  return raw.trim().slice(0, 100)
}

async function readLoginBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0)
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_LOGIN_BODY_BYTES) {
    throw new RangeError("Login body is too large")
  }
  if (!request.body) throw new SyntaxError("Missing login body")

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_LOGIN_BODY_BYTES) {
      await reader.cancel()
      throw new RangeError("Login body is too large")
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return failure({ succeeded: false, code: "INVALID_CREDENTIALS", message: "请求来源无效" }, 403)
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure({ succeeded: false, code: "INVALID_CREDENTIALS", message: "请求格式无效" }, 415)
  }

  let input: z.infer<typeof loginSchema>
  try {
    const parsed = loginSchema.safeParse(await readLoginBody(request))
    if (!parsed.success) {
      return failure({ succeeded: false, code: "INVALID_CREDENTIALS", message: "用户名或密码无效" }, 400)
    }
    input = parsed.data
  } catch (error) {
    if (error instanceof RangeError) {
      return failure({ succeeded: false, code: "INVALID_CREDENTIALS", message: "请求体过大" }, 413)
    }
    return failure({ succeeded: false, code: "INVALID_CREDENTIALS", message: "请求格式无效" }, 400)
  }

  const ipKey = clientKey(request)
  const accountKey = input.userName.toLocaleLowerCase("en-US")
  const ipRetryAfter = loginIpLimiter.consume(ipKey)
  const accountRetryAfter = loginAccountLimiter.consume(accountKey)
  const retryAfter = Math.max(ipRetryAfter, accountRetryAfter)
  if (retryAfter > 0) {
    return failure(
      { succeeded: false, code: "RATE_LIMITED", message: "登录尝试过多，请稍后再试" },
      429,
      retryAfter,
    )
  }

  try {
    const result = await authenticateViewer(input.userName, input.password, input.teamId)
    if (result.status === "invalid") {
      return failure(
        { succeeded: false, code: "INVALID_CREDENTIALS", message: "用户名或密码错误" },
        401,
      )
    }
    if (result.status === "team-required") {
      return failure(
        { succeeded: false, code: "TEAM_REQUIRED", message: "该账号尚未加入任何队伍" },
        403,
      )
    }
    if (result.status === "team-selection-required") {
      return failure(
        {
          succeeded: false,
          code: "TEAM_SELECTION_REQUIRED",
          message: "请选择本次观赛使用的队伍",
          teams: result.teams,
        },
        409,
      )
    }

    const session = viewerSessions.create(result.session, readViewerSessionId(request))
    if (!session) {
      return failure(
        { succeeded: false, code: "TEAM_SEAT_TAKEN", message: "该队伍已有一名观众在线" },
        409,
      )
    }

    loginAccountLimiter.clear(accountKey)
    return Response.json(
      { succeeded: true as const, ...viewerSessionInfo(session) },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": viewerSessionCookie(session.id),
        },
      },
    )
  } catch (error) {
    if (error instanceof GzctfLoginConfigurationError) {
      console.error("GZCTF viewer login configuration is unsupported", error)
    } else {
      console.error("GZCTF viewer login failed", error)
    }
    return failure(
      { succeeded: false, code: "UPSTREAM_UNAVAILABLE", message: "登录服务暂时不可用" },
      503,
    )
  }
}
