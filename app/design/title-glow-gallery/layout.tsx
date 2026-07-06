import type React from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/contexts/theme-context"
import "@/app/glow-effects.css"
import "@/app/theme-styles.css"
import "@/glow.css"

export const metadata: Metadata = {
  title: "标题 Glow Gallery",
  description: "赛事名称 Glow 在不同背景下的展示与截图辅助",
}

export default function TitleGlowGalleryLayout({
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

