import type { ChallengeCategory } from "@/types/scoreboard"

/**
 * Category 颜色统一来源（与 category-mapping-service 一致，新组件统一从此处取色）
 */
export const CATEGORY_COLORS: Record<ChallengeCategory, string> = {
  Web: "#ff6b6b",
  Crypto: "#4ecdc4",
  Pwn: "#45b7d1",
  Reverse: "#96ceb4",
  Blockchain: "#feca57",
  Forensics: "#ff9ff3",
  Hardware: "#54a0ff",
  Mobile: "#5f27cd",
  PPC: "#00d2d3",
  AI: "#ff6348",
  Pentest: "#2ed573",
  OSINT: "#ffa502",
  Misc: "#ff7675",
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as ChallengeCategory] || "#67E8F9"
}

/**
 * 一血/二血/三血统一配色
 */
export const BLOOD_COLORS = {
  FirstBlood: "#ef4444",
  SecondBlood: "#f97316",
  ThirdBlood: "#eab308",
} as const
