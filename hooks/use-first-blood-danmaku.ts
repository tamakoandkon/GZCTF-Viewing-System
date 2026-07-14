"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { DanmakuItem } from "@/components/danmaku"
import type { ScoreboardResponse } from "@/types/scoreboard"
import { getCategoryColor } from "@/lib/category-colors"
import { useDanmakuSound } from "./use-danmaku-sound"

interface UseFirstBloodDanmakuOptions {
  /** 是否启用弹幕（设置面板可关） */
  enabled?: boolean
  /** 是否启用音效 */
  soundEnabled?: boolean
}

/**
 * 一血弹幕 Hook
 *
 * 工作原理：
 * 1. 首次收到 scoreboard 时，记录所有已有的一血 challengeId（不触发弹幕，避免历史一血刷屏）
 * 2. 后续每次 scoreboard 更新，对比新出现的一血，触发弹幕 + 音效
 * 3. 使用 ref 存储已见集合，避免重复触发
 */
export function useFirstBloodDanmaku(
  scoreboard: ScoreboardResponse | null,
  options: UseFirstBloodDanmakuOptions = {},
) {
  const { enabled = true, soundEnabled = true } = options
  const [danmakuQueue, setDanmakuQueue] = useState<DanmakuItem[]>([])
  const seenFirstBloodsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const { playSound, setEnabled: setSoundEnabled } = useDanmakuSound()

  // 同步音效开关
  useEffect(() => {
    setSoundEnabled(soundEnabled)
  }, [soundEnabled, setSoundEnabled])

  useEffect(() => {
    if (!enabled || !scoreboard?.challenges) return

    // 第一次加载时，标记所有已有的一血，不触发弹幕
    if (!initializedRef.current) {
      Object.values(scoreboard.challenges).forEach(challenges => {
        challenges.forEach(challenge => {
          const firstBlood = challenge.bloods?.[0]
          if (firstBlood?.submitTimeUtc) {
            seenFirstBloodsRef.current.add(`${challenge.id}`)
          }
        })
      })
      initializedRef.current = true
      return
    }

    const newDanmaku: DanmakuItem[] = []
    Object.entries(scoreboard.challenges).forEach(([category, challenges]) => {
      challenges.forEach(challenge => {
        const firstBlood = challenge.bloods?.[0]
        if (!firstBlood || !firstBlood.submitTimeUtc) return
        const key = `${challenge.id}`
        if (seenFirstBloodsRef.current.has(key)) return

        seenFirstBloodsRef.current.add(key)
        const color = getCategoryColor(category)
        newDanmaku.push({
          id: `blood-${challenge.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: `🩸 ${firstBlood.name} 拿下 ${challenge.title} 一血！`,
          color,
        })
      })
    })

    if (newDanmaku.length > 0) {
      setDanmakuQueue(prev => [...prev, ...newDanmaku])
      newDanmaku.forEach(() => playSound())
    }
  }, [scoreboard?.challenges, enabled, playSound])

  const removeDanmaku = useCallback((id: string) => {
    setDanmakuQueue(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearDanmaku = useCallback(() => {
    setDanmakuQueue([])
  }, [])

  return { danmakuQueue, removeDanmaku, clearDanmaku }
}
