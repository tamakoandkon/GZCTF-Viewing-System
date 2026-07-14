import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
// import { Analytics } from '@vercel/analytics/next' // 禁用Vercel Analytics（非Vercel部署）
import './globals.css'
import '../style.css'

export const metadata: Metadata = {
  title: 'CTF 竞技场 - 3D可视化',
  description: 'GZCTF比赛数据3D可视化展示',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        {/* <Analytics /> 禁用Vercel Analytics */}
      </body>
    </html>
  )
}
