"use client"

import { Drop } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BloodType } from "@/types/scoreboard"
import { BLOOD_COLORS } from "@/lib/category-colors"

interface BloodBadgeProps {
  type: BloodType
  className?: string
  showLabel?: boolean
}

const BLOOD_LABELS: Record<string, string> = {
  FirstBlood: "一血",
  SecondBlood: "二血",
  ThirdBlood: "三血",
}

/**
 * 一血/二血/三血徽章
 * - FirstBlood: 红色
 * - SecondBlood: 橙色
 * - ThirdBlood: 黄色
 * - 其他类型不渲染
 */
export function BloodBadge({ type, className, showLabel = true }: BloodBadgeProps) {
  if (type !== "FirstBlood" && type !== "SecondBlood" && type !== "ThirdBlood") {
    return null
  }

  const color = BLOOD_COLORS[type]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none",
        className,
      )}
      style={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}66`,
      }}
    >
      <Drop className="w-2.5 h-2.5" style={{ fill: color }} />
      {showLabel && BLOOD_LABELS[type]}
    </span>
  )
}
