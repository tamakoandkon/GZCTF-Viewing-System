"use client"

import { useEffect, useRef, useState } from "react"
import { Settings } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

interface SettingsPanelProps {
  onToggleGUI?: () => void
  isGUIVisible?: boolean
}

export function SettingsPanel({ onToggleGUI, isGUIVisible = false }: SettingsPanelProps) {
  const { isDark, toggleTheme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isExpanded) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsExpanded(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isExpanded])

  function handleGUIToggle() {
    onToggleGUI?.()
    window.dispatchEvent(new CustomEvent("toggleGUI"))
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        aria-label="显示设置"
        aria-expanded={isExpanded}
        aria-controls="viewer-display-settings"
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </button>

      {isExpanded && (
        <div
          id="viewer-display-settings"
          role="group"
          aria-label="显示设置"
          className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-600 bg-slate-950 p-2 text-white shadow-lg"
        >
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={toggleTheme}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            深色模式
            <span className={`flex h-5 w-9 items-center rounded-full p-0.5 ${isDark ? "bg-cyan-500" : "bg-slate-600"}`} aria-hidden="true">
              <span className={`h-4 w-4 rounded-full bg-white transition-transform ${isDark ? "translate-x-4" : "translate-x-0"}`} />
            </span>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={isGUIVisible}
            onClick={handleGUIToggle}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            3D 控制面板
            <span className={`flex h-5 w-9 items-center rounded-full p-0.5 ${isGUIVisible ? "bg-cyan-500" : "bg-slate-600"}`} aria-hidden="true">
              <span className={`h-4 w-4 rounded-full bg-white transition-transform ${isGUIVisible ? "translate-x-4" : "translate-x-0"}`} />
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
