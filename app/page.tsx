import type { Metadata } from "next"

import { ViewerPortal } from "@/components/viewer-portal"

export const metadata: Metadata = {
  title: "观赛中心 | GZCTF",
  description: "使用 GZCTF 队员账号登录，选择比赛并查看只读观赛数据。",
}

export default function Home() {
  return <ViewerPortal />
}
