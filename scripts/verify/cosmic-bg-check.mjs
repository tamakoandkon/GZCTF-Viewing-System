// Cosmic background headless verification.
// Launches headless Chromium via Playwright, captures two screenshots,
// measures rAF fps and reports canvas / JS-heap / console health.
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const here = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(here, "..", "..")
const outDir = path.join(rootDir, "reports", "screenshots")
const url = process.env.SCREENSHOT_URL || "http://localhost:3000"

// 可移植：如需指定本地 chromium，用环境变量 CHROME_PATH
const HEADLESS_SHELL = process.env.CHROME_PATH || ""

await fs.mkdir(outDir, { recursive: true })

async function launchBrowser() {
  try {
    const b = await chromium.launch({ headless: true })
    console.error("[launch] using playwright default chromium")
    return b
  } catch (e) {
    console.error("[launch] default chromium unavailable, falling back to local headless shell")
    return await chromium.launch({ headless: true, executablePath: HEADLESS_SHELL })
  }
}

const browser = await launchBrowser()
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()

const consoleLogs = []
page.on("console", (msg) => {
  consoleLogs.push({ type: msg.type(), text: msg.text().slice(0, 2000) })
})
page.on("pageerror", (err) => {
  consoleLogs.push({ type: "pageerror", text: String(err && err.stack ? err.stack : err).slice(0, 2000) })
})

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 })

// Settle app redirect (e.g. / -> /scoreboard/3)
await page.waitForTimeout(1500)

// Wait 10 seconds: React mount + 3D scene and texture initialization.
await page.waitForTimeout(10000)

// Screenshot 1 (full page)
const shot1 = path.join(outDir, "cosmic-bg-check-1.png")
await page.screenshot({ path: shot1, fullPage: true })

// Rendering health check
const health = await page.evaluate(() => {
  const c = document.querySelector("canvas#webgl")
  return {
    url: location.href,
    title: document.title,
    visibilityState: document.visibilityState,
    canvasWebglExists: !!c,
    webgl: c
      ? {
          clientWidth: c.clientWidth,
          clientHeight: c.clientHeight,
          bufferWidth: c.width,
          bufferHeight: c.height,
        }
      : null,
    allCanvases: Array.from(document.querySelectorAll("canvas")).map((cv) => ({
      id: cv.id || null,
      cls: String(cv.className || "").slice(0, 80),
      clientWidth: cv.clientWidth,
      clientHeight: cv.clientHeight,
    })),
    perfMemoryAvailable: typeof performance !== "undefined" && !!performance.memory,
    jsHeap: performance.memory
      ? {
          usedMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
          totalMB: +(performance.memory.totalJSHeapSize / 1048576).toFixed(1),
          limitMB: +(performance.memory.jsHeapSizeLimit / 1048576).toFixed(1),
        }
      : null,
  }
})

// Rough fps: count requestAnimationFrame callbacks over 2 seconds.
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let count = 0
      const start = performance.now()
      function tick() {
        const elapsed = performance.now() - start
        if (elapsed >= 2000) {
          const duration = performance.now() - start
          resolve({
            frames: count,
            durationMs: +duration.toFixed(0),
            fps: +(count / (duration / 1000)).toFixed(1),
          })
          return
        }
        count += 1
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
)

// Wait 5 more seconds so galaxy rotation / nebula flow is visible.
await page.waitForTimeout(5000)

// Screenshot 2 (full page)
const shot2 = path.join(outDir, "cosmic-bg-check-2.png")
await page.screenshot({ path: shot2, fullPage: true })

const stat1 = await fs.stat(shot1)
const stat2 = await fs.stat(shot2)

const errorLogs = consoleLogs.filter(
  (l) => l.type === "error" || l.type === "pageerror"
)

const report = {
  url: health.url,
  title: health.title,
  screenshots: {
    shot1: { path: shot1, bytes: stat1.size },
    shot2: { path: shot2, bytes: stat2.size },
  },
  health,
  fps,
  console: {
    totalMessages: consoleLogs.length,
    errorCount: errorLogs.length,
    errors: errorLogs,
    all: consoleLogs,
  },
}

console.log("===COSMIC_BG_CHECK_BEGIN===")
console.log(JSON.stringify(report, null, 2))
console.log("===COSMIC_BG_CHECK_END===")

await browser.close()
