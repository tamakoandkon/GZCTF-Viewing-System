import type {
  ViewerLoginResponse,
  ViewerSessionInfo,
} from "@/types/viewer-session"

export async function getViewerSession(): Promise<ViewerSessionInfo | null> {
  const response = await fetch("/api/viewer/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Failed to read viewer session: ${response.status}`)
  return response.json() as Promise<ViewerSessionInfo>
}

export async function loginViewer(input: {
  userName: string
  password: string
  teamId?: number
}): Promise<ViewerLoginResponse> {
  const response = await fetch("/api/viewer/session/login", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return response.json() as Promise<ViewerLoginResponse>
}

export async function logoutViewer(): Promise<void> {
  await fetch("/api/viewer/session/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
}
