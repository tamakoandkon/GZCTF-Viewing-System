import fs from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"

const rootDir = process.cwd()
const outDir = path.join(rootDir, "reports", "screenshots")
const url = process.env.SCREENSHOT_URL || "http://localhost:3000/design/title-glow-gallery"

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

await fs.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })

const capture = async (viewport) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: "networkidle" })

  const viewportFile = path.join(outDir, `viewport-${viewport.width}x${viewport.height}.png`)
  await page.screenshot({ path: viewportFile, fullPage: true })
  console.log(`wrote ${path.relative(rootDir, viewportFile)}`)

  if (viewport.width >= 900) {
    for (const id of ids) {
      const locator = page.locator(`#${id}`)
      await locator.waitFor({ state: "visible", timeout: 30_000 })
      const file = path.join(outDir, `${id}.png`)
      await locator.screenshot({ path: file })
      console.log(`wrote ${path.relative(rootDir, file)}`)
    }
  }

  await context.close()
}

await capture({ width: 1920, height: 1080 })
await capture({ width: 1366, height: 768 })
await capture({ width: 375, height: 667 })

await browser.close()

