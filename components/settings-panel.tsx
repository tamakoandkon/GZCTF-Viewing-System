"use client"

import { useState, useEffect } from "react"
import { Settings, Eye, EyeOff, Palette, Globe, FlaskConical, ArrowUpDown, PartyPopper } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

interface SettingsPanelProps {
  onToggleGUI?: () => void
  isGUIVisible?: boolean
}

export function SettingsPanel({ onToggleGUI, isGUIVisible = false }: SettingsPanelProps) {
  const { theme, toggleTheme, isDark } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleThemeToggle = () => {
    setIsAnimating(true)
    toggleTheme()

    // 動畫完成後重置狀態
    setTimeout(() => {
      setIsAnimating(false)
    }, 600)
  }

  const handleGUIToggle = () => {
    onToggleGUI?.()
    // 觸發全局GUI切換事件
    window.dispatchEvent(new CustomEvent('toggleGUI'))
  }

  return (
    <div className="relative">
      {/* 主設置按鈕 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          theme-toggle-button
          relative w-12 h-12 rounded-xl p-2 flex items-center justify-center
          transition-all duration-300 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${
            isDark
              ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-cyan-500/30 focus:ring-cyan-500/50"
              : "bg-gradient-to-br from-blue-100/80 to-indigo-200/80 border border-blue-300/50 focus:ring-blue-400/50"
          }
          hover:scale-105 active:scale-95
          backdrop-blur-sm
          shadow-[0_0_12px_rgba(34,211,238,0.4),inset_0_0_8px_rgba(34,211,238,0.3)]
        `}
        title="設置面板"
        aria-label="設置面板"
      >
        <Settings 
          className={`w-6 h-6 transition-all duration-300 ${
            isDark ? "text-cyan-400" : "text-blue-600"
          }`} 
        />
        
        {/* 背景裝飾效果 */}
        <div
          className={`
            absolute inset-0 rounded-xl opacity-20
            transition-all duration-300
            ${
              isDark
                ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/20"
                : "bg-gradient-to-br from-blue-300/30 to-indigo-400/30"
            }
          `}
        />

        {/* 能量脈衝效果 */}
        {isAnimating && (
          <div
            className={`
            absolute inset-0 rounded-xl animate-ping
            ${isDark ? "bg-cyan-400/30" : "bg-blue-400/30"}
          `}
          />
        )}
      </button>

      {/* 展開的設置菜單 */}
      {isExpanded && (
        <div className={`
          absolute top-14 right-0 z-50
          glass-panel p-4 neon-border
          min-w-[200px] space-y-3
          transition-all duration-300 ease-in-out
          ${isDark ? "bg-slate-900/95" : "bg-blue-50/95"}
        `}>
          {/* 主題切換 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-blue-600"}`} />
              <span className="text-sm font-medium text-primary">主題模式</span>
            </div>
            <button
              onClick={handleThemeToggle}
              className={`
                relative w-12 h-6 rounded-full p-1
                transition-all duration-500 ease-in-out
                focus:outline-none
                ${
                  isDark
                    ? "bg-gradient-to-r from-slate-700 to-slate-800"
                    : "bg-gradient-to-r from-blue-200 to-indigo-300"
                }
                hover:scale-105
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full
                  transition-all duration-500 ease-in-out
                  flex items-center justify-center
                  ${
                    isDark
                      ? "left-1 bg-gradient-to-br from-cyan-400 to-blue-500"
                      : "left-7 bg-gradient-to-br from-yellow-400 to-orange-500"
                  }
                `}
              >
                <div className="relative w-3 h-3">
                  {isDark ? (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  ) : (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* GUI面板切換 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-blue-600"}`} />
              <span className="text-sm font-medium text-primary">3D控制面板</span>
            </div>
            <button
              onClick={handleGUIToggle}
              className={`
                relative w-12 h-6 rounded-full p-1
                transition-all duration-300 ease-in-out
                focus:outline-none
                ${
                  isGUIVisible
                    ? isDark 
                      ? "bg-gradient-to-r from-cyan-600 to-blue-700"
                      : "bg-gradient-to-r from-blue-400 to-indigo-500"
                    : isDark
                      ? "bg-gradient-to-r from-slate-700 to-slate-800"
                      : "bg-gradient-to-r from-gray-200 to-gray-300"
                }
                hover:scale-105
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full
                  transition-all duration-300 ease-in-out
                  flex items-center justify-center
                  ${
                    isGUIVisible
                      ? "left-7 bg-white"
                      : "left-1 bg-white"
                  }
                `}
              >
                {isGUIVisible ? (
                  <Eye className="w-2 h-2 text-gray-800" />
                ) : (
                  <EyeOff className="w-2 h-2 text-gray-600" />
                )}
              </div>
            </button>
          </div>

          {/* 測試工具 */}
          <div className="border-t border-border-primary/30 pt-2 mt-2 space-y-1.5">
            <div className="text-xs text-muted flex items-center gap-1.5">
              <FlaskConical className="w-3 h-3 text-yellow-400" />測試工具
            </div>
            <button onClick={() => { console.log('Dispatching test:attack'); window.dispatchEvent(new CustomEvent("test:attack")) }} className="w-full px-2 py-1 text-xs bg-cyan-500/15 border border-cyan-500/40 rounded text-cyan-400 hover:bg-cyan-500/25 transition-colors">射線攻擊測試</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent("test:promotion"))} className="w-full px-2 py-1 text-xs bg-cyan-500/15 border border-cyan-500/40 rounded text-cyan-400 hover:bg-cyan-500/25 transition-colors flex items-center justify-center gap-1"><ArrowUpDown className="w-3 h-3" />晉升動畫(第2→1名)</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent("game:ended"))} className="w-full px-2 py-1 text-xs bg-red-500/15 border border-red-500/40 rounded text-red-400 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-1"><PartyPopper className="w-3 h-3" />比賽結束儀式</button>
          </div>
        </div>
      )}

      {/* 點擊外部關閉菜單 */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  )
}
