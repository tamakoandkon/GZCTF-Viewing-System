"use client"

import { useRef, useCallback, useEffect } from "react"

/**
 * 弹幕音效 Hook
 * 使用 Web Audio API 程序化生成"叮咚"音效，无需外部音频文件
 *
 * 浏览器自动播放策略：
 * - AudioContext 创建可以即时
 * - resume() 必须在用户手势内调用
 * - 首次 click/keydown 时自动激活 AudioContext
 */
export function useDanmakuSound() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(true)

  const getCtx = useCallback(() => {
    if (typeof window === "undefined") return null
    if (!audioCtxRef.current) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AC) return null
        audioCtxRef.current = new AC()
      } catch {
        return null
      }
    }
    return audioCtxRef.current
  }, [])

  // 用户首次交互时激活 AudioContext
  useEffect(() => {
    const activate = () => {
      const ctx = getCtx()
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {})
      }
    }
    window.addEventListener("click", activate, { once: true })
    window.addEventListener("keydown", activate, { once: true })
    window.addEventListener("touchstart", activate, { once: true })
    return () => {
      window.removeEventListener("click", activate)
      window.removeEventListener("keydown", activate)
      window.removeEventListener("touchstart", activate)
    }
  }, [getCtx])

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled
  }, [])

  const playSound = useCallback(() => {
    if (!enabledRef.current) return
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    try {
      const now = ctx.currentTime
      // 三连升调"叮叮叮"音效，营造一血提示感
      const notes = [
        { freq: 880, start: 0, dur: 0.12, vol: 0.25 },
        { freq: 1108.73, start: 0.08, dur: 0.12, vol: 0.25 },
        { freq: 1318.51, start: 0.16, dur: 0.2, vol: 0.3 },
      ]
      notes.forEach(({ freq, start, dur, vol }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, now + start)
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + start)
        osc.stop(now + start + dur)
      })
    } catch {
      // 静默失败，不影响主流程
    }
  }, [getCtx])

  return { playSound, setEnabled }
}
