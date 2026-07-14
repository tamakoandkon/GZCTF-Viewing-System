"use client"

import { useEffect, useRef } from "react"

export interface DanmakuItem {
  id: string
  text: string
  color: string
}

interface DanmakuProps {
  items: DanmakuItem[]
  onItemExpire?: (id: string) => void
  /** 弹幕存活时长（毫秒），默认 8000 */
  duration?: number
}

/**
 * 弹幕层组件
 * - 从屏幕右侧滚入，左侧滚出
 * - 多条弹幕自动分行（最多 5 行）
 * - pointer-events: none，不阻挡交互
 * - 使用 styled-jsx 注入 keyframes，无需修改全局 CSS
 */
export function Danmaku({ items, onItemExpire, duration = 8000 }: DanmakuProps) {
  const expireTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // 组件卸载时清理所有计时器
  useEffect(() => {
    const timers = expireTimersRef.current
    return () => {
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // 新弹幕到来时设置过期计时器
  useEffect(() => {
    if (items.length === 0) return

    const newItems = items.filter(item => !expireTimersRef.current.has(item.id))
    if (newItems.length === 0) return

    newItems.forEach(item => {
      const timer = setTimeout(() => {
        onItemExpire?.(item.id)
        expireTimersRef.current.delete(item.id)
      }, duration)
      expireTimersRef.current.set(item.id, timer)
    })
  }, [items, onItemExpire, duration])

  if (items.length === 0) return null

  return (
    <>
      <style jsx>{`
        @keyframes danmaku-scroll {
          from {
            transform: translateX(0);
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          to {
            transform: translateX(calc(-100vw - 100%));
            opacity: 0;
          }
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
        {items.map((item, idx) => {
          // 5 行弹幕通道，避开顶部 header（约 80px）和底部状态栏
          const lane = idx % 5
          const top = 90 + lane * 55
          const animDuration = 7 + (idx % 3) * 0.8
          return (
            <div
              key={item.id}
              className="absolute whitespace-nowrap font-bold text-xl lg:text-2xl"
              style={{
                top: `${top}px`,
                left: "100%",
                color: item.color,
                textShadow: `0 0 10px ${item.color}, 0 0 20px ${item.color}, 2px 2px 4px rgba(0,0,0,0.8)`,
                animation: `danmaku-scroll ${animDuration}s linear forwards`,
              }}
            >
              {item.text}
            </div>
          )
        })}
      </div>
    </>
  )
}
