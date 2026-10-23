import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
// import { Analytics } from '@vercel/analytics/next' // 禁用Vercel Analytics（非Vercel部署）
import './globals.css'
import '../style.css'

export const metadata: Metadata = {
  title: 'Viewing Room | CTF 观赛中心',
  description: '独立的 CTF 赛事实时可视化观赛系统',
  icons: { icon: '/viewing-room-mark.svg' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        {children}
        {/* <Analytics /> 禁用Vercel Analytics */}
      </body>
    </html>
  )
}
