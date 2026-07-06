import fs from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"

const rootDir = process.cwd()
const outDir = path.join(rootDir, "reports", "screenshots")
const url = process.env.TITLE_URL || "http://localhost:3000/design/title-demo"

const cases = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 375, height: 667 },
]

await fs.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })

for (const vp of cases) {
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: "domcontentloaded" })

  const header = page.locator(".glass-panel-header").first()
  await header.waitFor({ state: "visible", timeout: 60_000 })
  await page.waitForTimeout(750)

  const title = page.locator(".event-title-text")
  await title.waitFor({ state: "attached", timeout: 60_000 })

  const box = await title.boundingBox()
  if (!box) throw new Error("No bounding box for .event-title-text")

  const viewportSize = page.viewportSize()
  if (!viewportSize) throw new Error("No viewport size")

  const titleCenter = box.x + box.width / 2
  const viewportCenter = viewportSize.width / 2
  const delta = Math.abs(titleCenter - viewportCenter)

  const headerFile = path.join(outDir, `scoreboard-title-${vp.width}x${vp.height}.png`)
  await header.screenshot({ path: headerFile })

  console.log(`${vp.width}x${vp.height} centerDeltaPx=${delta.toFixed(2)} screenshot=${path.relative(rootDir, headerFile)}`)

  if (delta > 2.5) {
    throw new Error(`Title not centered: delta ${delta.toFixed(2)}px @ ${vp.width}x${vp.height}`)
  }

  await context.close()
}

await browser.close()

