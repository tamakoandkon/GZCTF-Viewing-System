import fs from "node:fs/promises"
import path from "node:path"

import { PNG } from "pngjs"
import { chromium } from "playwright"

const rootDir = process.cwd()
const outDir = path.join(rootDir, "reports")
const url = process.env.GLOW_GALLERY_URL || "http://localhost:3000/design/title-glow-gallery"

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 375, height: 667 },
]

const colorSchemes = ["light", "dark"]
const brightnessCases = [0.8, 1.0, 1.2]

const ids = [
  "bg-01",
  "bg-02",
  "bg-03",
  "bg-04",
  "bg-05",
  "bg-06",
  "bg-07",
  "bg-08",
  "bg-09",
  "bg-10",
]

const profiles = [
  {
    name: "baseline",
    vars: {
      "--event-title-glow-opacity-1": "0.80",
      "--event-title-glow-opacity-2": "0.72",
      "--event-title-glow-opacity-3": "0.65",
      "--event-title-glow-opacity-4": "0.60",
      "--event-title-glow-blur-1": "6px",
      "--event-title-glow-blur-2": "8px",
      "--event-title-glow-blur-3": "10px",
      "--event-title-glow-blur-4": "10px",
      "--event-title-glow-offset": "0px",
      "--event-title-glow-blend": "normal",
      "--event-title-glow-after-blur": "14px",
      "--event-title-glow-after-opacity": "0.55",
    },
  },
  {
    name: "optimized",
    vars: {
      "--event-title-glow-opacity-1": "0.55",
      "--event-title-glow-opacity-2": "0.44",
      "--event-title-glow-opacity-3": "0.28",
      "--event-title-glow-opacity-4": "0.16",
      "--event-title-glow-blur-1": "2px",
      "--event-title-glow-blur-2": "10px",
      "--event-title-glow-blur-3": "22px",
      "--event-title-glow-blur-4": "52px",
      "--event-title-glow-offset": "1px",
      "--event-title-glow-blend": "screen",
      "--event-title-glow-after-blur": "32px",
      "--event-title-glow-after-opacity": "0.8",
    },
  },
]

const clamp01 = (n) => Math.min(1, Math.max(0, n))

function srgbToLinear(x) {
  const v = x / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function luminance(r, g, b) {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function decodePng(buffer) {
  return PNG.sync.read(buffer)
}

function computeMetrics(offPng, onPng, { brightness = 1 } = {}) {
  if (offPng.width !== onPng.width || offPng.height !== onPng.height) {
    throw new Error("PNG size mismatch")
  }

  const pxCount = offPng.width * offPng.height
  const maskThreshold = 0.45
  const deltaThreshold = 0.02

  let maskedCount = 0
  let deltaSum = 0
  let deltaSumSq = 0
  let deltaAbove = 0

  const deltas = []

  for (let i = 0; i < pxCount; i++) {
    const idx = i * 4

    const or = clamp01((offPng.data[idx] / 255) * brightness) * 255
    const og = clamp01((offPng.data[idx + 1] / 255) * brightness) * 255
    const ob = clamp01((offPng.data[idx + 2] / 255) * brightness) * 255

    const nr = clamp01((onPng.data[idx] / 255) * brightness) * 255
    const ng = clamp01((onPng.data[idx + 1] / 255) * brightness) * 255
    const nb = clamp01((onPng.data[idx + 2] / 255) * brightness) * 255

    const loff = luminance(or, og, ob)
    const lon = luminance(nr, ng, nb)

    if (loff >= maskThreshold) continue
    const d = Math.abs(lon - loff)
    maskedCount += 1
    deltaSum += d
    deltaSumSq += d * d
    if (d >= deltaThreshold) deltaAbove += 1
    deltas.push(d)
  }

  deltas.sort((a, b) => a - b)
  const mean = maskedCount ? deltaSum / maskedCount : 0
  const variance = maskedCount ? deltaSumSq / maskedCount - mean * mean : 0
  const std = Math.sqrt(Math.max(0, variance))
  const p95 = deltas.length ? deltas[Math.floor(deltas.length * 0.95)] : 0
  const areaPct = maskedCount ? (deltaAbove / maskedCount) * 100 : 0

  return {
    maskedPixels: maskedCount,
    meanDeltaL: mean,
    p95DeltaL: p95,
    stdDeltaL: std,
    haloAreaPct: areaPct,
  }
}

function format(n, digits = 4) {
  return Number.isFinite(n) ? n.toFixed(digits) : "0.0000"
}

function mdTable(rows) {
  const header =
    "| 背景 | 亮度 | meanΔL | p95ΔL | haloArea% |\n|---|---:|---:|---:|---:|\n"
  return (
    header +
    rows
      .map(
        (r) =>
          `| ${r.id} | ${r.brightness.toFixed(1)} | ${format(r.metrics.meanDeltaL, 4)} | ${format(r.metrics.p95DeltaL, 4)} | ${r.metrics.haloAreaPct.toFixed(2)} |`
      )
      .join("\n") +
    "\n"
  )
}

await fs.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

for (const viewport of viewports) {
  for (const scheme of colorSchemes) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scheme })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: "networkidle" })

    for (const profile of profiles) {
      await page.evaluate((vars) => {
        for (const [k, v] of Object.entries(vars)) {
          document.documentElement.style.setProperty(k, v)
        }
      }, profile.vars)

      for (const id of ids) {
        const container = page.locator(`#${id}`)
        await container.waitFor({ state: "visible", timeout: 30_000 })

        const children = container.locator(":scope > div")
        const off = children.nth(0)
        const on = children.nth(1)

        const offBuf = await off.screenshot()
        const onBuf = await on.screenshot()

        const offPng = decodePng(offBuf)
        const onPng = decodePng(onBuf)

        for (const b of brightnessCases) {
          const metrics = computeMetrics(offPng, onPng, { brightness: b })
          results.push({ profile: profile.name, viewport, scheme, id, brightness: b, metrics })
        }
      }
    }

    await context.close()
  }
}

await browser.close()

const jsonPath = path.join(outDir, "glow-visibility.json")
await fs.writeFile(
  jsonPath,
  JSON.stringify({ url, viewports, colorSchemes, brightnessCases, profiles: profiles.map((p) => p.name), results }, null, 2),
  "utf8"
)

const mdPath = path.join(outDir, "glow-visibility.md")
let md = "# Glow 可視化量化報告\n\n"
md += `- 頁面：${url}\n`
md += `- 指標：在"非文字主體區域（off 亮度 < 0.45）"內計算 on/off 的亮度差（ΔL）\n`
md += `  - meanΔL：平均亮度差（越大越顯眼）\n`
md += `  - p95ΔL：95 分位亮度差（反映最明顯的 halo 貢獻）\n`
md += `  - haloArea%：ΔL ≥ 0.02 的像素佔比（越大表示 halo 覆蓋範圍更大）\n\n`

for (const viewport of viewports) {
  for (const scheme of colorSchemes) {
    for (const profile of profiles) {
      md += `## ${viewport.width}×${viewport.height} · ${scheme} · ${profile.name}\n\n`
      const rows = results
        .filter(
          (r) =>
            r.profile === profile.name &&
            r.viewport.width === viewport.width &&
            r.viewport.height === viewport.height &&
            r.scheme === scheme
        )
        .map((r) => ({ id: r.id, brightness: r.brightness, metrics: r.metrics }))
      md += mdTable(rows)
    }
  }
}

await fs.writeFile(mdPath, md, "utf8")
console.log(`wrote ${path.relative(rootDir, jsonPath)}`)
console.log(`wrote ${path.relative(rootDir, mdPath)}`)

