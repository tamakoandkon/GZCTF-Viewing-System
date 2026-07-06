"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      // 从localStorage读取保存的主题设置
      const savedTheme = localStorage.getItem("ctf-theme") as Theme
      if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) {
        setTheme(savedTheme)
      } else {
        // 检测系统主题偏好
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        setTheme(prefersDark ? "dark" : "light")
      }
    } catch (error) {
      // 如果localStorage不可用，使用默认主题
      console.warn("Failed to load theme from localStorage:", error)
      setTheme("dark")
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      try {
        // 保存主题设置到localStorage
        localStorage.setItem("ctf-theme", theme)
      } catch (error) {
        console.warn("Failed to save theme to localStorage:", error)
      }

      // 更新document的data-theme属性
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", theme)
        // 更新body的class
        document.body.className = theme === "dark" ? "theme-dark" : "theme-light"
      }
    }
  }, [theme, mounted])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  const value = {
    theme,
    toggleTheme,
    isDark: theme === "dark",
  }

  // 避免hydration不匹配
  if (!mounted) {
    return (
      <div className="theme-loading" data-theme="dark">
        <div className="theme-dark">{children}</div>
      </div>
    )
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    // 提供fallback值而不是抛出错误
    console.warn("useTheme must be used within a ThemeProvider. Using default values.")
    return {
      theme: "dark" as Theme,
      toggleTheme: () => {},
      isDark: true,
    }
  }
  return context
}
