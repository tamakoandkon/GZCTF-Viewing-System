const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

export interface UserProfile {
  userName: string
  name: string
  email: string
  image?: string
  role: 'admin' | 'user'
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
const AUTH_KEY = 'gzctf-viewer-auth'

function loadAuth(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveAuth(user: UserProfile) {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

function clearAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_KEY)
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
      name: credentials.userName,
      email: '',
      role: 'admin'
    }
    saveAuth(user)
    return { succeeded: true }
  } catch (err: any) {
    return { succeeded: false, msg: err.message || '网络错误' }
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
