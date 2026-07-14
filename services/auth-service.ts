import { AuthService } from './auth-service-interface'

/**
 * 认证服务——简化的 NextAuth 用户态
 * 使用 client-side session 判断，未来可扩展为真实 OAuth
 */

export interface UserProfile {
  name: string
  email: string
  image?: string
  role: 'admin' | 'user'
}

class AuthServiceImpl implements AuthService {
  private currentUser: UserProfile | null = null

  async getSession() {
    try {
      const res = await fetch('/api/auth/session')
      if (!res.ok) return null
      const data = await res.json()
      if (data?.user) {
        this.currentUser = {
          name: data.user.name ?? 'Unknown',
          email: data.user.email ?? '',
          image: data.user.image,
          role: data.user.role ?? 'user'
        }
      }
      return data
    } catch {
      return null
    }
  }

  getUser(): UserProfile | null {
    return this.currentUser
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin'
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null
  }
}

export const authService = new AuthServiceImpl()
