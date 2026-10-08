"use client"

import { useEffect, useState } from "react"
import { CheckCircle, Loader2, Lock, LogIn, Shield, Users } from "lucide-react"

import { GameSelection } from "@/components/game-selection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getViewerSession, loginViewer, logoutViewer } from "@/services/viewer-auth-service"
import type { ViewerSessionInfo, ViewerTeam } from "@/types/viewer-session"

export function ViewerPortal() {
  const [session, setSession] = useState<ViewerSessionInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userName, setUserName] = useState("")
  const [password, setPassword] = useState("")
  const [teams, setTeams] = useState<ViewerTeam[]>([])
  const [teamId, setTeamId] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getViewerSession()
      .then((current) => {
        if (active) setSession(current)
      })
      .catch(() => {
        if (active) setError("暂时无法检查登录状态")
      })
      .finally(() => {
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => {
      void getViewerSession().then((current) => {
        if (!current) {
          setSession(null)
          setError("观赛席位已失效，请重新登录")
        }
      })
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [session])

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await loginViewer({ userName, password, teamId })
      if (result.succeeded) {
        setSession(result)
        setPassword("")
        setTeams([])
        setTeamId(undefined)
      } else {
        setError(result.message)
        if (result.code === "TEAM_SELECTION_REQUIRED" && result.teams?.length) {
          setTeams(result.teams)
          setTeamId(result.teams[0].id)
        }
      }
    } catch {
      setError("登录服务暂时不可用")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setSubmitting(true)
    try {
      await logoutViewer()
    } finally {
      setSession(null)
      setPassword("")
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex items-center gap-3 text-lg text-white">
        <Loader2 className="h-6 w-6 animate-spin" /> 正在检查观赛席位...
      </div>
    )
  }

  if (session) {
    return <GameSelection viewer={session} onLogout={() => void handleLogout()} loggingOut={submitting} />
  }

  return (
    <Card className="w-full max-w-md border-2 border-primary/20 shadow-2xl backdrop-blur-sm bg-background/95">
      <CardHeader className="space-y-3 border-b border-primary/10 pb-6">
        <div className="flex justify-center mb-2">
          <Shield className="w-14 h-14 text-cyan-400" />
        </div>
        <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          队伍观赛登录
        </CardTitle>
        <CardDescription className="text-center text-base">
          使用 GZCTF 队员账号登录；每支队伍同时只开放一个观赛席位
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="viewer-user">GZCTF 用户名或邮箱</Label>
            <Input
              id="viewer-user"
              autoComplete="username"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              disabled={submitting || teams.length > 0}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="viewer-password">密码</Label>
            <Input
              id="viewer-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting || teams.length > 0}
              required
            />
          </div>

          {teams.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="viewer-team">选择观赛队伍</Label>
              <select
                id="viewer-team"
                value={teamId}
                onChange={(event) => setTeamId(Number(event.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                className="px-0 text-xs"
                onClick={() => {
                  setTeams([])
                  setTeamId(undefined)
                }}
              >
                更换账号
              </Button>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full h-12">
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
            {teams.length > 0 ? "使用所选队伍登录" : "登录并领取观赛席位"}
          </Button>

          <div className="space-y-2 border-t border-primary/10 pt-4 text-xs text-muted-foreground">
            <p><Lock className="mr-1 inline h-3 w-3" />GZCTF Cookie 仅保存在服务端，不会发送到浏览器。</p>
            <p><Users className="mr-1 inline h-3 w-3" />关闭页面后，席位最多约 90 秒自动释放。</p>
            <p><CheckCircle className="mr-1 inline h-3 w-3" />观赛接口仍只返回脱敏排行榜数据。</p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
