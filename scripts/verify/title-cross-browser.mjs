import { chromium, firefox, webkit } from "playwright"

const url = process.env.TITLE_URL || "http://localhost:3000/design/title-demo"

const browserTypes = [
  { name: "chromium", type: chromium },
  { name: "firefox", type: firefox },
  { name: "webkit", type: webkit },
]

const themes = ["dark", "light"]

function parseRgb(input) {
  const m = input.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!m) return null
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
}

let ran = 0

for (const b of browserTypes) {
  let browser
  try {
    browser = await b.type.launch({ headless: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`SKIP ${b.name} launch failed: ${msg.split("\n")[0]}`)
    continue
  }

  ran += 1

  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
    })

    const page = await context.newPage()
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("ctf-theme", t)
      } catch {
      }
    }, theme)

    await page.goto(url, { waitUntil: "domcontentloaded" })
    await page.locator(".glass-panel-header").first().waitFor({ state: "visible", timeout: 60_000 })
    await page.waitForTimeout(750)

    const title = page.locator(".event-title-text").first()
    await title.waitFor({ state: "attached", timeout: 60_000 })

    const box = await title.boundingBox()
    if (!box) throw new Error(`[${b.name}/${theme}] missing .event-title-text bounding box`)

    const viewportSize = page.viewportSize()
    if (!viewportSize) throw new Error(`[${b.name}/${theme}] missing viewport size`)

    const centerDelta = Math.abs(box.x + box.width / 2 - viewportSize.width / 2)
    if (centerDelta > 2.5) {
      throw new Error(`[${b.name}/${theme}] title not centered: delta ${centerDelta.toFixed(2)}px`)
    }

    const computed = await title.evaluate((el) => {
      const cs = getComputedStyle(el)
      const before = getComputedStyle(el, "::before")
      const after = getComputedStyle(el, "::after")

      return {
        color: cs.color,
        textShadow: cs.textShadow,
        transformStyle: cs.transformStyle,
        perspective: cs.perspective,
        webkitTextFillColor: cs.webkitTextFillColor,
        beforeOpacity: before.opacity,
        beforeContent: before.content,
        afterOpacity: after.opacity,
        afterContent: after.content,
      }
    })

    const rgb = parseRgb(computed.color)
    if (!rgb) throw new Error(`[${b.name}/${theme}] cannot parse title color: ${computed.color}`)
    if (rgb.r < 235 || rgb.g < 235 || rgb.b < 235) {
      throw new Error(`[${b.name}/${theme}] title color is not white enough: ${computed.color}`)
    }

    if (!computed.textShadow || computed.textShadow === "none") {
      throw new Error(`[${b.name}/${theme}] missing text-shadow`)
    }

    if (computed.transformStyle !== "preserve-3d" || computed.perspective === "none") {
      throw new Error(`[${b.name}/${theme}] missing 3D settings (transform-style/perspective)`)
    }

    if (computed.beforeContent === "none" || Number(computed.beforeOpacity) <= 0) {
      throw new Error(`[${b.name}/${theme}] ::before layer missing`)
    }

    if (computed.afterContent === "none" || Number(computed.afterOpacity) <= 0) {
      throw new Error(`[${b.name}/${theme}] ::after layer missing`)
    }

    console.log(
      `PASS ${b.name}/${theme} color=${computed.color} fill=${computed.webkitTextFillColor} shadow=${computed.textShadow.slice(0, 60)}... centerDelta=${centerDelta.toFixed(2)}`
    )

    await context.close()
  }

  await browser.close()
}

if (!ran) {
  throw new Error("No Playwright browsers available")
}

