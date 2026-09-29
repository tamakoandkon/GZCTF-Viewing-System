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
const THEME_KEY = "ctf-theme:v1"
const LEGACY_THEME_KEY = "ctf-theme"

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedTheme = localStorage.getItem(THEME_KEY)
        const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY)
        const nextTheme = isTheme(storedTheme)
          ? storedTheme
          : isTheme(legacyTheme)
            ? legacyTheme
            : window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light"

        if (!storedTheme && isTheme(legacyTheme)) {
          localStorage.setItem(THEME_KEY, legacyTheme)
          localStorage.removeItem(LEGACY_THEME_KEY)
        }
        setTheme(nextTheme)
      } catch (error) {
        console.warn("Failed to load theme from localStorage:", error)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    document.body.classList.toggle("theme-dark", theme === "dark")
    document.body.classList.toggle("theme-light", theme === "light")
  }, [theme])

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    try {
      localStorage.setItem(THEME_KEY, nextTheme)
    } catch (error) {
      console.warn("Failed to save theme to localStorage:", error)
    }
  }

  const value = {
    theme,
    toggleTheme,
    isDark: theme === "dark",
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
