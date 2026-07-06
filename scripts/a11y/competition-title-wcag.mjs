const clamp01 = (n) => Math.min(1, Math.max(0, n))

function parseHex(hex) {
  const normalized = hex.replace(/^#/, "").trim()
  if (normalized.length !== 6) throw new Error(`Unsupported hex: ${hex}`)
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return { r, g, b, a: 1 }
}

function rgba(r, g, b, a = 1) {
  return { r, g, b, a: clamp01(a) }
}

function blend(fg, bg) {
  const a = clamp01(fg.a)
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  }
}

function srgbToLinear(c) {
  const x = c / 255
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

function luminance(color) {
  const r = srgbToLinear(color.r)
  const g = srgbToLinear(color.g)
  const b = srgbToLinear(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function formatColor(c) {
  const r = Math.round(c.r)
  const g = Math.round(c.g)
  const b = Math.round(c.b)
  return `rgb(${r}, ${g}, ${b})`
}

function assertLargeTextAA({ name, fg, bg, minRatio = 4.5 }) {
  const ratio = contrastRatio(fg, bg)
  const ok = ratio >= minRatio
  const line = `${ok ? "PASS" : "FAIL"} ${name} contrast=${ratio.toFixed(2)} fg=${formatColor(fg)} bg=${formatColor(bg)}`
  console.log(line)
  if (!ok) {
    const error = new Error(`${name} contrast ${ratio.toFixed(2)} < ${minRatio}`)
    error.details = { ratio, fg, bg, minRatio }
    throw error
  }
}

function run() {
  const darkBase = parseHex("#0f1b2e")
  const darkOverlay = rgba(103, 232, 249, 0.15)
  const darkHeaderBg = blend(darkOverlay, darkBase)

  const lightBase = parseHex("#1e3a8a")
  const lightOverlay = rgba(2, 132, 199, 0.3)
  const lightHeaderBg = blend(lightOverlay, lightBase)

  const fillTop = rgba(255, 255, 255, 0.98)
  const fillBottom = rgba(180, 224, 255, 0.96)

  const darkTop = blend(fillTop, darkHeaderBg)
  const darkBottom = blend(fillBottom, darkHeaderBg)
  const lightTop = blend(fillTop, lightHeaderBg)
  const lightBottom = blend(fillBottom, lightHeaderBg)

  assertLargeTextAA({ name: "dark theme (fill top)", fg: darkTop, bg: darkHeaderBg })
  assertLargeTextAA({ name: "dark theme (fill bottom)", fg: darkBottom, bg: darkHeaderBg })
  assertLargeTextAA({ name: "light theme (fill top)", fg: lightTop, bg: lightHeaderBg })
  assertLargeTextAA({ name: "light theme (fill bottom)", fg: lightBottom, bg: lightHeaderBg })
}

try {
  run()
} catch (e) {
  console.error(String(e && e.message ? e.message : e))
  process.exitCode = 1
}

