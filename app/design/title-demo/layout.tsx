import type React from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/contexts/theme-context"
import "@/app/glow-effects.css"
import "@/app/theme-styles.css"
import "@/glow.css"

export const metadata: Metadata = {
  title: "赛事名称样式 Demo",
  description: "顶部赛事名称 3D/动态效果演示与可访问性验证",
}

export default function TitleDemoLayout({
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

