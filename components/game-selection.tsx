"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Gamepad2,
  LogOut,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react"

import {
  formatGameTime,
  getGamesList,
  getGameStatus,
  sortGamesForViewing,
  type GameInfo,
} from "@/services/games-list-service"
import type { ViewerSessionInfo } from "@/types/viewer-session"
import styles from "./viewer-portal.module.css"

type GameStatus = ReturnType<typeof getGameStatus>
type StatusFilter = "all" | GameStatus

const statusText: Record<GameStatus, string> = {
  active: "进行中",
  upcoming: "即将开始",
  ended: "已结束",
}

const actionText: Record<GameStatus, string> = {
  active: "进入观赛",
  upcoming: "查看赛场",
  ended: "查看结果",
}

function isoGameTime(timestamp: number): string | undefined {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

interface GameSelectionProps {
  viewer: ViewerSessionInfo
  onLogout: () => void
  loggingOut: boolean
  sessionNotice: string | null
}

export function GameSelection({ viewer, onLogout, loggingOut, sessionNotice }: GameSelectionProps) {
  const [games, setGames] = useState<GameInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")

  const loadGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setGames(sortGamesForViewing(await getGamesList()))
    } catch (reason) {
      console.error("Failed to load public games", reason)
      setError("比赛列表暂时不可用，请重试。")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void loadGames(), 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadGames])

  const counts = {
    all: games.length,
    active: games.filter((game) => getGameStatus(game) === "active").length,
    upcoming: games.filter((game) => getGameStatus(game) === "upcoming").length,
    ended: games.filter((game) => getGameStatus(game) === "ended").length,
  }
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN")
  const visibleGames = games.filter(
    (game) =>
      (filter === "all" || getGameStatus(game) === filter) &&
      game.title.toLocaleLowerCase("zh-CN").includes(normalizedQuery),
  )

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "active", label: "进行中" },
    { value: "upcoming", label: "即将开始" },
    { value: "ended", label: "已结束" },
  ]

  return (
    <section className={styles.selection} aria-labelledby="selection-heading">
      <div className={styles.selectionHero}>
        <div>
          <p className={styles.selectionEyebrow}>YOUR VIEWING SEAT</p>
          <h1 id="selection-heading">选择一场比赛</h1>
          <p>浏览比赛赛况，按自己的节奏进入观赛。</p>
        </div>
        <div className={styles.viewerIdentity}>
          <span className={styles.teamAvatar} aria-hidden="true"><UsersRound size={20} /></span>
          <span className={styles.identityText}>
            <strong title={viewer.team.name}>{viewer.team.name}</strong>
            <span title={viewer.userName}>{viewer.userName} 的观赛席位</span>
          </span>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={onLogout}
            disabled={loggingOut}
            aria-label={loggingOut ? "正在退出" : "退出登录"}
            title="退出登录"
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {sessionNotice && <p className={styles.selectionNotice} role="alert">{sessionNotice}</p>}

      <div className={styles.selectionToolbar}>
        <div className={styles.filterList} role="group" aria-label="按比赛状态筛选">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.filterButton} ${filter === option.value ? styles.filterButtonActive : ""}`}
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
            >
              {option.label}<span className={styles.filterCount}>{counts[option.value]}</span>
            </button>
          ))}
        </div>
        <div className={styles.toolbarRight}>
          <label className={styles.searchBox}>
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">搜索比赛名称</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索比赛名称"
            />
          </label>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadGames()}
            disabled={loading}
            aria-label={loading ? "正在刷新比赛列表" : "刷新比赛列表"}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <RefreshCw className={styles.spinner} size={27} aria-hidden="true" />
          <h2>正在加载比赛</h2>
          <p>马上为你整理可观看的赛场。</p>
        </div>
      ) : error ? (
        <div className={styles.emptyState} role="alert">
          <Gamepad2 size={30} aria-hidden="true" />
          <h2>暂时无法加载比赛</h2>
          <p>{error}</p>
          <button className={styles.clearButton} type="button" onClick={() => void loadGames()}>
            重新加载
          </button>
        </div>
      ) : games.length === 0 ? (
        <div className={styles.emptyState}>
          <Gamepad2 size={30} aria-hidden="true" />
          <h2>暂时没有可观看的比赛</h2>
          <p>稍后再回来看看，或刷新列表获取最新比赛。</p>
        </div>
      ) : (
        <>
          <p className={styles.resultCount} role="status">
            找到 {visibleGames.length} 场比赛
          </p>
          {visibleGames.length === 0 ? (
            <div className={styles.emptyState}>
              <Search size={29} aria-hidden="true" />
              <h2>没有匹配的比赛</h2>
              <p>试试其他名称，或清除筛选条件。</p>
              <button
                className={styles.clearButton}
                type="button"
                onClick={() => {
                  setFilter("all")
                  setQuery("")
                }}
              >
                清除筛选
              </button>
            </div>
          ) : (
            <div className={styles.gamesGrid}>
              {visibleGames.map((game) => {
                const status = getGameStatus(game)
                return (
                  <Link
                    key={game.id}
                    href={`/scoreboard/${game.id}`}
                    prefetch={false}
                    className={styles.gameCard}
                    aria-label={`${game.title}，${statusText[status]}，${actionText[status]}`}
                  >
                    <div className={styles.gameVisual} aria-hidden="true">
                      {game.poster ? (
                        // Posters are served from the allowlisted, signed public image route.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={game.poster} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Gamepad2 className={styles.gameVisualPlaceholder} size={54} strokeWidth={1.25} />
                      )}
                    </div>
                    <div className={styles.gameContent}>
                      <span
                        className={`${styles.gameStatus} ${
                          status === "active"
                            ? styles.statusActive
                            : status === "upcoming"
                              ? styles.statusUpcoming
                              : styles.statusEnded
                        }`}
                      >
                        {statusText[status]}
                      </span>
                      <h2 className={styles.gameTitle}>{game.title}</h2>
                      {game.summary && <p className={styles.gameSummary}>{game.summary}</p>}
                      <div className={styles.gameFoot}>
                        <span className={styles.gameTime}>
                          <span>开始 <strong><time dateTime={isoGameTime(game.start)}>{formatGameTime(game.start)}</time></strong></span>
                          <span>结束 <strong><time dateTime={isoGameTime(game.end)}>{formatGameTime(game.end)}</time></strong></span>
                        </span>
                        <span className={styles.gameAction}>
                          {actionText[status]} <ArrowUpRight size={16} aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
