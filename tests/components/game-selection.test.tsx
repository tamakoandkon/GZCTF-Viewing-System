import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GameSelection } from "@/components/game-selection"
import type { ViewerSessionInfo } from "@/types/viewer-session"

const getGamesListMock = vi.hoisted(() => vi.fn())
vi.mock("@/services/games-list-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/games-list-service")>()
  return { ...original, getGamesList: getGamesListMock }
})

const viewer: ViewerSessionInfo = {
  authenticated: true,
  userName: "spectator",
  team: { id: 12, name: "Blue Team" },
}

beforeEach(() => {
  getGamesListMock.mockReset()
  const now = Date.now()
  getGamesListMock.mockResolvedValue([
    { id: 3, title: "Past CTF", summary: "", poster: null, limit: 0, start: now - 200_000, end: now - 100_000 },
    { id: 2, title: "Future CTF", summary: "", poster: null, limit: 0, start: now + 100_000, end: now + 200_000 },
    { id: 1, title: "Live CTF", summary: "", poster: null, limit: 0, start: now - 100_000, end: now + 100_000 },
  ])
})

describe("GameSelection", () => {
  it("offers semantic links in viewing priority and lets spectators clear filters", async () => {
    render(<GameSelection viewer={viewer} onLogout={() => {}} loggingOut={false} sessionNotice={null} />)

    await screen.findByRole("link", { name: /Live CTF/ })
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/scoreboard/1",
      "/scoreboard/2",
      "/scoreboard/3",
    ])

    fireEvent.click(screen.getByRole("button", { name: /已结束/ }))
    expect(screen.getByRole("link", { name: /Past CTF/ })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Live CTF/ })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索比赛名称" }), {
      target: { value: "missing" },
    })
    expect(screen.getByText("没有匹配的比赛")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }))

    expect(screen.getByRole("link", { name: /Live CTF/ })).toBeInTheDocument()
    expect(screen.getByRole("searchbox", { name: "搜索比赛名称" })).toHaveValue("")
  })

  it("provides a retry after a list request fails", async () => {
    getGamesListMock.mockRejectedValueOnce(new Error("offline"))
    render(<GameSelection viewer={viewer} onLogout={() => {}} loggingOut={false} sessionNotice={null} />)

    await screen.findByRole("button", { name: "重新加载" })
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }))
    await waitFor(() => expect(screen.getByRole("link", { name: /Live CTF/ })).toBeInTheDocument())
    expect(getGamesListMock).toHaveBeenCalledTimes(2)
  })
})
