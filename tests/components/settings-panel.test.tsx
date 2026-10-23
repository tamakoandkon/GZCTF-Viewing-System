import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SettingsPanel } from "@/components/settings-panel"

const toggleTheme = vi.fn()
vi.mock("@/contexts/theme-context", () => ({
  useTheme: () => ({ isDark: true, toggleTheme }),
}))

describe("SettingsPanel", () => {
  it("keeps viewing controls accessible and closes on Escape", () => {
    const onToggleGUI = vi.fn()
    render(<SettingsPanel onToggleGUI={onToggleGUI} isGUIVisible={false} />)

    const trigger = screen.getByRole("button", { name: "显示设置" })
    fireEvent.click(trigger)

    const theme = screen.getByRole("switch", { name: "深色模式" })
    const gui = screen.getByRole("switch", { name: "3D 控制面板" })
    expect(theme).toHaveAttribute("aria-checked", "true")
    expect(gui).toHaveAttribute("aria-checked", "false")
    expect(screen.queryByText("测试工具")).not.toBeInTheDocument()

    fireEvent.click(theme)
    fireEvent.click(gui)
    expect(toggleTheme).toHaveBeenCalledOnce()
    expect(onToggleGUI).toHaveBeenCalledOnce()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole("switch", { name: "深色模式" })).not.toBeInTheDocument()
  })
})
