"use client"

import * as React from "react"

import { CompetitionTitle } from "@/components/competition-title"

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mediaQuery.matches)
    update()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update)
      return () => mediaQuery.removeEventListener("change", update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  return reduced
}

export function CompetitionTitleDynamicDemo() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const [title, setTitle] = React.useState("网络安全攻防竞赛 · 实时计分板")
  const [enabled, setEnabled] = React.useState(true)
  const [intensity, setIntensity] = React.useState(0.65)
  const [speed, setSpeed] = React.useState(0.7)
  const [debugPanel, setDebugPanel] = React.useState(false)

  const pointerRef = React.useRef({ x: 0.5, y: 0.45 })
  const rafRef = React.useRef<number | null>(null)
  const timeRef = React.useRef(0)

  React.useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    return () => ro.disconnect()
  }, [])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const x = (e.clientX - rect.left) / Math.max(1, rect.width)
      const y = (e.clientY - rect.top) / Math.max(1, rect.height)
      pointerRef.current = {
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
      }
    }

    container.addEventListener("pointermove", onPointerMove)
    return () => container.removeEventListener("pointermove", onPointerMove)
  }, [])

  React.useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const render = (t: number) => {
      if (!enabled || prefersReducedMotion) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      if (timeRef.current === 0) timeRef.current = t
      const dt = Math.min(64, t - timeRef.current)
      timeRef.current = t

      const seconds = dt / 1000
      const phase = (t / 1000) * speed
      const { x: px, y: py } = pointerRef.current

      const w = container.clientWidth
      const h = container.clientHeight
      const cx = (0.5 + 0.28 * Math.sin(phase)) * w
      const cy = (0.48 + 0.18 * Math.cos(phase * 0.9)) * h

      const mixX = (cx * 0.55 + px * w * 0.45)
      const mixY = (cy * 0.55 + py * h * 0.45)

      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = "source-over"

      const base = ctx.createRadialGradient(mixX, mixY, 0, mixX, mixY, Math.max(w, h) * 0.7)
      base.addColorStop(0, `rgba(2, 132, 199, ${0.28 * intensity})`)
      base.addColorStop(0.35, `rgba(125, 211, 252, ${0.12 * intensity})`)
      base.addColorStop(1, "rgba(0, 0, 0, 0)")
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = "screen"
      const sweepX = (0.1 + ((phase * 0.12) % 1)) * w
      const sweep = ctx.createLinearGradient(sweepX - w * 0.2, 0, sweepX + w * 0.2, 0)
      sweep.addColorStop(0, "rgba(255,255,255,0)")
      sweep.addColorStop(0.5, `rgba(255,255,255,${0.07 * intensity})`)
      sweep.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = sweep
      ctx.fillRect(0, 0, w, h)

      if (rafRef.current !== null) {
        rafRef.current = window.requestAnimationFrame(render)
      }

      timeRef.current += seconds
    }

    rafRef.current = window.requestAnimationFrame(render)
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      timeRef.current = 0
    }
  }, [enabled, intensity, speed, prefersReducedMotion])

  React.useEffect(() => {
    if (!debugPanel) return
    let cleanup: { unmount?: () => void } | null = null

    import("@/glow.js")
      .then((mod) => {
        cleanup = mod.mountGlowDebugPanel?.() || null
      })
      .catch(() => null)

    return () => {
      if (cleanup && typeof cleanup.unmount === "function") cleanup.unmount()
    }
  }, [debugPanel])

  return (
    <div className="min-h-screen deep-space-bg p-4 lg:p-8">
      <div className="glass-panel max-w-5xl mx-auto overflow-hidden">
        <div className="glass-panel-header border-b-0 px-3 py-2 lg:px-5 lg:py-4">
          <div ref={containerRef} className="relative flex items-center justify-center py-2">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden="true"
            />
            <CompetitionTitle title={title} className="relative" />
          </div>
        </div>

        <div className="p-4 lg:p-6 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-slate-200">赛事名称</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-3 py-2 text-slate-100"
            />
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            <label className="grid gap-1">
              <span className="text-sm text-slate-200">动态光照</span>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                className="rounded-md bg-black/20 border border-white/10 px-3 py-2 text-slate-100 text-left"
              >
                {prefersReducedMotion ? "已根据系统偏好关闭" : enabled ? "开启" : "关闭"}
              </button>
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-slate-200">强度</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-slate-200">速度</span>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.01}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm text-slate-200">调试面板</span>
            <button
              type="button"
              onClick={() => setDebugPanel((v) => !v)}
              className="rounded-md bg-black/20 border border-white/10 px-3 py-2 text-slate-100 text-left"
            >
              {debugPanel ? "已开启" : "已关闭"}
            </button>
          </label>

          <div className="text-sm text-slate-300">
            提示：该 Demo 使用 Canvas 2D 绘制动态光照层；在开启“减少动态效果”系统设置时会自动停用。
          </div>
        </div>
      </div>
    </div>
  )
}

