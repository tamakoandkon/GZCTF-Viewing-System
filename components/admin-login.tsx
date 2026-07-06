"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { login, isAuthenticated, logout, getUserInfo } from "@/services/auth-service"
import { getGamesList, sortGamesByRecent, getGameStatus, getGameStatusText, getGameStatusColor, formatGameTime, BASE_URL, type GameInfo } from "@/services/games-list-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Trophy, Clock, CheckCircle, ChevronRight, Shield, Gamepad2, LogIn, Lock } from "lucide-react"

export function AdminLogin() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated())
  const [showGameSelection, setShowGameSelection] = useState(false)
  const [games, setGames] = useState<GameInfo[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const userInfo = getUserInfo()

  // 检查是否已登录，如果是则直接显示游戏选择
  useEffect(() => {
    if (isLoggedIn && !showGameSelection) {
      setShowGameSelection(true)
    }
  }, [isLoggedIn])

  // 登录成功后加载游戏列表
  useEffect(() => {
    if (showGameSelection && games.length === 0) {
      loadGames()
    }
  }, [showGameSelection])

  const loadGames = async () => {
    setLoadingGames(true)
    try {
      const gamesList = await getGamesList()
      const sortedGames = sortGamesByRecent(gamesList)
      setGames(sortedGames)
    } catch (err) {
      console.error('Failed to load games:', err)
      setError('加载游戏列表失败')
    } finally {
      setLoadingGames(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await login({ userName, password })
      
      if (result.succeeded) {
        setSuccess(true)
        setIsLoggedIn(true)
        
        // 显示游戏选择界面
        setTimeout(() => {
          setShowGameSelection(true)
        }, 500)
      } else {
        setError(result.msg || '登录失败，请检查用户名和密码')
      }
    } catch (err: any) {
      setError(err.message || '登录失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await logout()
      setIsLoggedIn(false)
      setSuccess(false)
      setShowGameSelection(false)
      setGames([])
      
      // 刷新页面
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGameSelect = (gameId: number) => {
    router.push(`/scoreboard/${gameId}`)
  }

  // 游戏选择界面
  if (showGameSelection) {
    return (
      <div className="w-full max-w-6xl">
        <Card className="border-2 border-primary/20 shadow-2xl backdrop-blur-sm bg-background/95">
          <CardHeader className="border-b border-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  <Gamepad2 className="w-6 h-6 mr-2 inline-block text-cyan-400" /> 选择比赛
                </CardTitle>
                <CardDescription className="text-lg mt-2">
                  欢迎回来，{userInfo?.userName || '管理员'} | 选择要观看的比赛
                </CardDescription>
              </div>
              <Button onClick={handleLogout} variant="outline" disabled={loading}>
                退出登录
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loadingGames ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-lg">加载游戏列表中...</span>
              </div>
            ) : games.length === 0 ? (
              <Alert>
                <AlertDescription>暂无可用的比赛</AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => {
                  const status = getGameStatus(game)
                  const statusText = getGameStatusText(game)
                  const statusColor = getGameStatusColor(game)
                  
                  return (
                    <Card
                      key={game.id}
                      className={`cursor-pointer transition-all duration-200 hover:brightness-110 hover:shadow-xl border-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                        status === 'active' 
                          ? 'border-green-500/50 bg-green-500/5 hover:border-green-500' 
                          : status === 'upcoming'
                          ? 'border-yellow-500/50 bg-yellow-500/5 hover:border-yellow-500'
                          : 'border-gray-500/50 bg-gray-500/5 hover:border-gray-500'
                      }`}
                      onClick={() => handleGameSelect(game.id)}
                    >
                      {game.poster && (
                        <div className="h-32 overflow-hidden rounded-t-lg">
                          <img 
                            src={`${BASE_URL}${game.poster}`}
                            alt={game.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg line-clamp-2 flex-1">
                            {game.title}
                          </CardTitle>
                          <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        </div>
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor} w-fit`}>
                          {statusText}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {game.summary && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {game.summary}
                          </p>
                        )}
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>开始：{formatGameTime(game.start)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3" />
                            <span>结束：{formatGameTime(game.end)}</span>
                          </div>
                          {game.limit > 0 && (
                            <div className="flex items-center gap-2">
                              <Trophy className="h-3 w-3" />
                              <span>队伍限制：{game.limit}人</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // 登录表单
  return (
    <Card className="w-full max-w-md border-2 border-primary/20 shadow-2xl backdrop-blur-sm bg-background/95">
      <CardHeader className="space-y-3 border-b border-primary/10 pb-6">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 blur-xl opacity-50"></div>
            <Shield className="w-16 h-16 text-cyan-400" />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          CTF 竞技场
        </CardTitle>
        <CardDescription className="text-center text-base">
          管理员登录以访问比赛数据和3D可视化
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <Alert variant="destructive" className="border-2">
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-2 border-green-500 bg-green-500/10">
              <AlertDescription className="font-medium text-green-600">
                <CheckCircle className="w-4 h-4 inline-block mr-1 text-green-400" /> 登录成功！正在加载游戏列表...
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="userName" className="text-base font-semibold">
              用户名
            </Label>
            <Input
              id="userName"
              type="text"
              placeholder="输入管理员用户名"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={loading}
              required
              className="h-12 text-base border-2 focus:border-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base font-semibold">
              密码
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="h-12 text-base border-2 focus:border-primary transition-all"
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2 inline-block" /> 立即登录
              </>
            )}
          </Button>

          <div className="pt-4 border-t border-primary/10">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              <Lock className="w-3 h-3 inline-block mr-1" /> 仅授权管理员可以访问此系统<br/>
              系统将自动保持登录状态24小时
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

