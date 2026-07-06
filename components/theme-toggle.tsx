"use client"

import { useTheme } from "@/contexts/theme-context"
import { Moon, Sun } from "lucide-react"
import { useState } from "react"

export function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme()
  const [isAnimating, setIsAnimating] = useState(false)

  const handleToggle = () => {
    setIsAnimating(true)
    toggleTheme()

    // 动画完成后重置状态
    setTimeout(() => {
      setIsAnimating(false)
    }, 600)
  }

  return (
    <button
      onClick={handleToggle}
      className={`
        theme-toggle-button
        relative w-16 h-8 rounded-full p-1
        transition-all duration-500 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${
          isDark
            ? "bg-gradient-to-r from-slate-800 to-slate-900 border border-cyan-500/30 focus:ring-cyan-500/50"
            : "bg-gradient-to-r from-blue-100 to-indigo-200 border border-blue-300/50 focus:ring-blue-400/50"
        }
        hover:scale-105 active:scale-95
        ${isAnimating ? "animate-pulse" : ""}
      `}
      title={`切换到${isDark ? "浅色" : "深色"}模式`}
      aria-label={`切换到${isDark ? "浅色" : "深色"}模式`}
    >
      {/* 滑动指示器 */}
      <div
        className={`
          absolute top-1 w-6 h-6 rounded-full
          transition-all duration-500 ease-in-out
          flex items-center justify-center
          ${
            isDark
              ? "left-1 bg-gradient-to-br from-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(34,211,238,0.6)]"
              : "left-9 bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
          }
          ${isAnimating ? "animate-spin" : ""}
        `}
      >
        {/* 图标切换 */}
        <div className="relative w-4 h-4">
          <Moon
            className={`
              absolute inset-0 w-4 h-4 text-white
              transition-all duration-300
              ${isDark ? "opacity-100 rotate-0" : "opacity-0 rotate-180"}
            `}
          />
          <Sun
            className={`
              absolute inset-0 w-4 h-4 text-white
              transition-all duration-300
              ${isDark ? "opacity-0 -rotate-180" : "opacity-100 rotate-0"}
            `}
          />
        </div>
      </div>

      {/* 背景装饰效果 */}
      <div
        className={`
        absolute inset-0 rounded-full opacity-20
        transition-all duration-500
        ${
          isDark
            ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20"
            : "bg-gradient-to-r from-yellow-300/30 to-orange-400/30"
        }
      `}
      />

      {/* 能量脉冲效果 */}
      {isAnimating && (
        <div
          className={`
          absolute inset-0 rounded-full animate-ping
          ${isDark ? "bg-cyan-400/30" : "bg-yellow-400/30"}
        `}
        />
      )}

      {/* 侧边指示灯 */}
      <div
        className={`
        absolute top-2 w-1 h-4 rounded-full
        transition-all duration-500
        ${
          isDark
            ? "right-1 bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
            : "left-1 bg-gradient-to-b from-yellow-400 to-orange-500 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
        }
      `}
      />
    </button>
  )
}
