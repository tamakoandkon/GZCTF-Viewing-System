"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react"

import { GameSelection } from "@/components/game-selection"
import { getViewerSession, loginViewer, logoutViewer } from "@/services/viewer-auth-service"
import type { ViewerSessionInfo, ViewerTeam } from "@/types/viewer-session"
import styles from "./viewer-portal.module.css"

export function ViewerPortal() {
  const [session, setSession] = useState<ViewerSessionInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userName, setUserName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
        if (active) setError("暂时无法检查登录状态，请稍后重试。")
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
      void getViewerSession()
        .then((current) => {
          if (!current) {
            setSession(null)
            setError("观赛席位已失效，请重新登录。")
          }
        })
        .catch(() => {
          setError("暂时无法确认观赛席位，网络恢复后会自动重试。")
        })
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [session])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await loginViewer({ userName, password, teamId })
      if (result.succeeded) {
        setSession(result)
        setPassword("")
        setShowPassword(false)
        setTeams([])
        setTeamId(undefined)
      } else if (result.code === "TEAM_SELECTION_REQUIRED" && result.teams?.length) {
        setTeams(result.teams)
        setTeamId(result.teams[0].id)
      } else {
        setError(result.message)
      }
    } catch {
      setError("登录服务暂时不可用，请稍后重试。")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setSubmitting(true)
    setError(null)
    try {
      await logoutViewer()
      setSession(null)
      setPassword("")
      setUserName("")
    } catch {
      try {
        if (!(await getViewerSession())) {
          setSession(null)
          setPassword("")
          setUserName("")
          return
        }
      } catch {
        // Keep the current view when the server cannot confirm whether logout completed.
      }
      setError("暂时无法确认退出状态，请检查网络后重试。")
    } finally {
      setSubmitting(false)
    }
  }

  function changeAccount() {
    setTeams([])
    setTeamId(undefined)
    setUserName("")
    setPassword("")
    setShowPassword(false)
    setError(null)
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.siteHeader}>
          <div className={styles.brand} aria-label="Viewing Room 观赛中心">
            <span className={styles.brandMark} aria-hidden="true">
              <Image src="/viewing-room-mark.svg" width={38} height={38} alt="" />
            </span>
            <span>
              <span className={styles.brandName}>VIEWING ROOM</span>
              <span className={styles.brandDivider} aria-hidden="true" />
              <span className={styles.brandSuffix}>观赛中心</span>
            </span>
          </div>
          <span className={styles.headerNote}>只读观赛 · 独立席位</span>
        </header>

        {checking ? (
          <section className={styles.checking} role="status" aria-live="polite">
            <LoaderCircle className={styles.spinner} size={25} aria-hidden="true" />
            <p>正在确认观赛席位…</p>
          </section>
        ) : session ? (
          <GameSelection
            viewer={session}
            onLogout={() => void handleLogout()}
            loggingOut={submitting}
            sessionNotice={error}
          />
        ) : (
          <div className={styles.loginLayout}>
            <section className={styles.intro} aria-labelledby="portal-heading">
              <div className={styles.introCopy}>
                <span className={styles.eyebrow}>
                  <span className={styles.eyebrowDot} aria-hidden="true" />
                  THE VIEWING ROOM
                </span>
                <h1 id="portal-heading">为每一场精彩，<br />留一个好位置。</h1>
                <p>使用你的 GZCTF 队员账号进入观赛中心，选择比赛，查看实时赛况。</p>
              </div>
              <div className={styles.orbitArt} aria-hidden="true">
                <div className={styles.orbitOuter} />
                <div className={styles.orbitMiddle} />
                <div className={styles.orbitInner} />
                <div className={styles.orbitCore}>
                  <Image src="/viewing-room-mark.svg" width={104} height={104} alt="" />
                </div>
                <span className={styles.orbitPointOne} />
                <span className={styles.orbitPointTwo} />
                <span className={styles.orbitCaption}>WATCH THE GAME UNFOLD</span>
              </div>
              <div className={styles.introFoot}>
                <span className={styles.introFootLine} aria-hidden="true" />
                每支队伍同时开放一个观赛席位
              </div>
            </section>

            <section className={styles.loginPanel} aria-labelledby="login-heading">
              <div className={styles.panelTop}>
                <div className={styles.panelIcon} aria-hidden="true">
                  <LockKeyhole size={22} strokeWidth={1.9} />
                </div>
                <span className={styles.panelStep}>{teams.length > 0 ? "02 / 02" : "01 / 02"}</span>
              </div>
              <p className={styles.panelEyebrow}>欢迎进入观赛中心</p>
              <h2 id="login-heading">{teams.length > 0 ? "选择观赛队伍" : "登录你的账号"}</h2>
              <p className={styles.panelDescription}>
                {teams.length > 0
                  ? "这个账号属于多个队伍。请选择本次使用的观赛席位。"
                  : "使用已有的 GZCTF 队员账号，无需创建新账号。"}
              </p>

              <form onSubmit={handleLogin} className={styles.form}>
                {error && <p className={styles.formError} role="alert">{error}</p>}

                {teams.length > 0 ? (
                  <fieldset className={styles.teamFieldset}>
                    <legend>选择队伍</legend>
                    <div className={styles.teamChoices}>
                      {teams.map((team) => (
                        <label key={team.id} className={styles.teamChoice}>
                          <input
                            type="radio"
                            name="viewer-team"
                            value={team.id}
                            checked={teamId === team.id}
                            onChange={() => setTeamId(team.id)}
                            disabled={submitting}
                          />
                          <span className={styles.teamChoiceMark} aria-hidden="true" />
                          <span>{team.name}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      className={styles.textButton}
                      type="button"
                      onClick={changeAccount}
                      disabled={submitting}
                    >
                      返回，更换账号
                    </button>
                  </fieldset>
                ) : (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="viewer-user">用户名或邮箱</label>
                      <input
                        id="viewer-user"
                        name="username"
                        autoComplete="username"
                        value={userName}
                        onChange={(event) => setUserName(event.target.value)}
                        placeholder="输入 GZCTF 用户名或邮箱"
                        disabled={submitting}
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="viewer-password">密码</label>
                      <div className={styles.passwordField}>
                        <input
                          id="viewer-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="输入密码"
                          disabled={submitting}
                          required
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "隐藏密码" : "显示密码"}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((visible) => !visible)}
                          disabled={submitting}
                        >
                          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <button className={styles.primaryButton} type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle className={styles.spinner} size={19} aria-hidden="true" />
                      正在验证…
                    </>
                  ) : (
                    <>
                      {teams.length > 0 ? "使用所选队伍继续" : "登录并领取席位"}
                      <ArrowRight size={19} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <div className={styles.privacyNote}>
                <ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true" />
                <p>GZCTF 登录凭据仅用于身份验证；观赛页只显示脱敏比赛数据。</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
