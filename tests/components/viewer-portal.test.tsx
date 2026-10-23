import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ViewerPortal } from "@/components/viewer-portal"

const authMocks = vi.hoisted(() => ({
  getViewerSession: vi.fn(),
  loginViewer: vi.fn(),
  logoutViewer: vi.fn(),
}))
vi.mock("@/services/viewer-auth-service", () => authMocks)
vi.mock("@/components/game-selection", () => ({
  GameSelection: ({ viewer }: { viewer: { team: { name: string } } }) => (
    <div>已进入 {viewer.team.name} 的比赛选择页</div>
  ),
}))

beforeEach(() => {
  authMocks.getViewerSession.mockReset().mockResolvedValue(null)
  authMocks.loginViewer.mockReset()
  authMocks.logoutViewer.mockReset()
})

describe("ViewerPortal", () => {
  it("lets users reveal a password, choose a team, and continue", async () => {
    authMocks.loginViewer
      .mockResolvedValueOnce({
        succeeded: false,
        code: "TEAM_SELECTION_REQUIRED",
        message: "选择队伍",
        teams: [{ id: 1, name: "Alpha" }, { id: 2, name: "Beta" }],
      })
      .mockResolvedValueOnce({
        succeeded: true,
        authenticated: true,
        userName: "alice",
        team: { id: 2, name: "Beta" },
      })

    render(<ViewerPortal />)
    const password = await screen.findByLabelText("密码")
    fireEvent.change(screen.getByLabelText("用户名或邮箱"), { target: { value: "alice" } })
    fireEvent.change(password, { target: { value: "secret" } })
    fireEvent.click(screen.getByRole("button", { name: "显示密码" }))
    expect(password).toHaveAttribute("type", "text")
    fireEvent.click(screen.getByRole("button", { name: "登录" }))

    await screen.findByRole("radio", { name: "Beta" })
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }))
    fireEvent.click(screen.getByRole("button", { name: "继续" }))

    await waitFor(() => expect(screen.getByText("已进入 Beta 的比赛选择页")).toBeInTheDocument())
    expect(authMocks.loginViewer).toHaveBeenNthCalledWith(2, {
      userName: "alice",
      password: "secret",
      teamId: 2,
    })
  })

  it("clears the old credentials when changing accounts", async () => {
    authMocks.loginViewer.mockResolvedValueOnce({
      succeeded: false,
      code: "TEAM_SELECTION_REQUIRED",
      message: "选择队伍",
      teams: [{ id: 1, name: "Alpha" }, { id: 2, name: "Beta" }],
    })

    render(<ViewerPortal />)
    fireEvent.change(await screen.findByLabelText("用户名或邮箱"), { target: { value: "alice" } })
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret" } })
    fireEvent.click(screen.getByRole("button", { name: "登录" }))
    await screen.findByRole("button", { name: "返回，更换账号" })
    fireEvent.click(screen.getByRole("button", { name: "返回，更换账号" }))

    expect(screen.getByLabelText("用户名或邮箱")).toHaveValue("")
    expect(screen.getByLabelText("密码")).toHaveValue("")
  })
})
