import type React from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/contexts/theme-context"
import "@/app/glow-effects.css"
import "@/app/theme-styles.css"
import "@/glow.css"
import "@/app/tweakpane-theme.css"

export const metadata: Metadata = {
  title: "实时计分板",
  description: "网络安全攻防竞赛实时计分板",
}

export default function ScoreboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <div className="font-sans antialiased">{children}</div>
    </ThemeProvider>
  )
}
