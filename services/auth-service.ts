export interface UserProfile {
  userName: string
}

interface LoginCredentials {
  userName: string
  password: string
}

interface LoginResult {
  succeeded: boolean
  msg?: string
}

// Persistent auth state in localStorage
const AUTH_KEY = 'gzctf-viewer-auth:v1'
const LEGACY_AUTH_KEY = 'gzctf-viewer-auth'

function parseUserProfile(raw: string | null): UserProfile | null {
  if (!raw) return null

  try {
    const value: unknown = JSON.parse(raw)
    if (
      typeof value === 'object' &&
      value !== null &&
      'userName' in value &&
      typeof value.userName === 'string' &&
      value.userName.length > 0
    ) {
      return { userName: value.userName }
    }
  } catch {
    // Treat malformed or stale storage as logged out.
  }

  return null
}

function loadAuth(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const currentProfile = parseUserProfile(localStorage.getItem(AUTH_KEY))
    if (currentProfile) return currentProfile

    const legacyProfile = parseUserProfile(localStorage.getItem(LEGACY_AUTH_KEY))
    if (legacyProfile) {
      saveAuth(legacyProfile)
      localStorage.removeItem(LEGACY_AUTH_KEY)
    }
    return legacyProfile
  } catch {
    return null
  }
}

function saveAuth(user: UserProfile) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ userName: user.userName }))
  } catch {
    // Private browsing and storage policies can make localStorage unavailable.
  }
}

function clearAuth() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(LEGACY_AUTH_KEY)
  } catch {
    // The server cookie still controls API authorization.
  }
}

export function isAuthenticated(): boolean {
  return loadAuth() !== null
}

export function getUserInfo(): UserProfile | null {
  return loadAuth()
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  try {
    const response = await fetch('/api/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials)
    })

    if (!response.ok) {
      const msg = await response.text().catch(() => '登录失败')
      return { succeeded: false, msg }
    }

    const user: UserProfile = {
      userName: credentials.userName,
    }
    saveAuth(user)
    return { succeeded: true }
  } catch (err) {
    return { succeeded: false, msg: err instanceof Error ? err.message : '网络错误' }
  }
}

export async function logout() {
  clearAuth()
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // 通过 Next.js 代理转发 /api/* 请求，避免跨域问题
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  })

  if (response.status === 401) {
    clearAuth()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
  }

  return response
}
