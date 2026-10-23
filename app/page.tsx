import type { Metadata } from "next"

import { ViewerPortal } from "@/components/viewer-portal"

export const metadata: Metadata = {
  title: "Viewing Room | 观赛中心",
  description: "选择比赛，查看实时赛况。",
}

export default function Home() {
  return <ViewerPortal />
}
