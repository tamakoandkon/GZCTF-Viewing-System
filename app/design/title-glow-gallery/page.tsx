"use client"

import * as React from "react"

import { CompetitionTitle } from "@/components/competition-title"

type Sample = {
  id: string
  name: string
  style: React.CSSProperties
}

const samples: Sample[] = [
  {
    id: "bg-01",
    name: "Deep Space",
    style: {
      background:
        "radial-gradient(ellipse at top, rgba(26, 42, 58, 0.45), transparent), radial-gradient(ellipse at bottom, rgba(15, 23, 34, 0.7), transparent), linear-gradient(180deg, #0f1b2e 0%, #1a2332 35%, #0d1421 100%)",
    },
  },
  {
    id: "bg-02",
    name: "Navy Panel",
    style: { background: "#0b1220" },
  },
  {
    id: "bg-03",
    name: "Slate Panel",
    style: { background: "#111827" },
  },
  {
    id: "bg-04",
    name: "Blue Steel",
    style: { background: "linear-gradient(135deg, #0b1020, #102a43)" },
  },
  {
    id: "bg-05",
    name: "Light Theme Blue",
    style: { background: "linear-gradient(180deg, #1e3a8a 0%, #3b82f6 55%, #1e40af 100%)" },
  },
  {
    id: "bg-06",
    name: "Glass Strip",
    style: { background: "linear-gradient(90deg, rgba(103, 232, 249, 0.18), rgba(103, 232, 249, 0.08), rgba(103, 232, 249, 0.18))" },
  },
  {
    id: "bg-07",
    name: "Muted Blue",
    style: { background: "#1b2b46" },
  },
  {
    id: "bg-08",
    name: "Charcoal",
    style: { background: "#0b0f16" },
  },
  {
    id: "bg-09",
    name: "Indigo",
    style: { background: "linear-gradient(135deg, #111827, #312e81)" },
  },
  {
    id: "bg-10",
    name: "Gradient Gray",
    style: { background: "linear-gradient(180deg, #0d1421 0%, #1a2332 100%)" },
  },
]

export default function TitleGlowGalleryPage() {
  const [debugPanel, setDebugPanel] = React.useState(false)

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
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-6xl mx-auto grid gap-4">
        <div className="glass-panel p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setDebugPanel((v) => !v)}
              className="rounded-md bg-black/20 border border-white/10 px-3 py-2 text-slate-100 text-left"
            >
              {debugPanel ? "调试面板：开启" : "调试面板：关闭"}
            </button>
            <div className="text-sm text-slate-300 flex items-center">用于截图：每张卡片左侧 Glow 关闭，右侧 Glow 开启</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {samples.map((s) => (
            <div key={s.id} className="glass-panel overflow-hidden">
              <div className="glass-panel-header p-3 lg:p-4 flex items-center justify-between">
                <span>{s.name}</span>
                <span className="text-xs text-slate-200/80">{s.id}</span>
              </div>
              <div
                id={s.id}
                style={s.style}
                className="px-3 py-6 grid grid-cols-2 gap-3 items-center"
              >
                <div className="glow-off flex flex-col items-center justify-center gap-2 px-2 py-6">
                  <div className="text-xs text-white/75">Glow Off</div>
                  <CompetitionTitle title="网络安全攻防竞赛 · 实时计分板" />
                </div>
                <div className="flex flex-col items-center justify-center gap-2 px-2 py-6">
                  <div className="text-xs text-white/75">Glow On</div>
                  <CompetitionTitle title="网络安全攻防竞赛 · 实时计分板" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

