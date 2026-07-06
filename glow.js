const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

function rgbToHex(r, g, b) {
  const toHex = (x) => x.toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgb(hex) {
  const raw = String(hex || "").trim().replace(/^#/, "")
  if (raw.length !== 6) return null
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  return { r, g, b }
}

function readNumberStyleVar(style, name, fallback) {
  const raw = style.getPropertyValue(name).trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function readPxStyleVar(style, name, fallback) {
  const raw = style.getPropertyValue(name).trim()
  if (!raw) return fallback
  const m = raw.match(/^([0-9]+(?:\.[0-9]+)?)px$/)
  if (!m) return fallback
  const n = Number(m[1])
  return Number.isFinite(n) ? n : fallback
}

function readRgbStyleVar(style, name, fallback) {
  const raw = style.getPropertyValue(name).trim()
  if (!raw) return fallback
  const parts = raw.split(/\s+/).map((v) => Number(v))
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return fallback
  return { r: parts[0], g: parts[1], b: parts[2] }
}

function setCssVar(el, name, value) {
  el.style.setProperty(name, String(value))
}

function persist(storageKey, state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    return
  }
}

function restore(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function mountGlowDebugPanel({
  storageKey = "event-title-glow-debug",
  root = document.documentElement,
} = {}) {
  const computed = getComputedStyle(root)
  const defaultRgb = readRgbStyleVar(computed, "--event-title-glow-rgb", { r: 2, g: 132, b: 199 })
  const defaults = {
    color: rgbToHex(defaultRgb.r, defaultRgb.g, defaultRgb.b),
    opacity1: readNumberStyleVar(computed, "--event-title-glow-opacity-1", 0.8),
    opacity4: readNumberStyleVar(computed, "--event-title-glow-opacity-4", 0.6),
    blur1: readPxStyleVar(computed, "--event-title-glow-blur-1", 6),
    blur4: readPxStyleVar(computed, "--event-title-glow-blur-4", 10),
  }

  const restored = restore(storageKey)
  const state = {
    ...defaults,
    ...(restored && typeof restored === "object" ? restored : null),
  }

  const panel = document.createElement("section")
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-label", "Glow 調試面板")
  panel.tabIndex = -1
  panel.style.position = "fixed"
  panel.style.right = "12px"
  panel.style.bottom = "12px"
  panel.style.width = "320px"
  panel.style.maxWidth = "calc(100vw - 24px)"
  panel.style.padding = "12px"
  panel.style.borderRadius = "10px"
  panel.style.background = "rgba(10, 25, 47, 0.82)"
  panel.style.border = "1px solid rgba(255, 255, 255, 0.14)"
  panel.style.backdropFilter = "blur(12px)"
  panel.style.color = "rgba(255, 255, 255, 0.92)"
  panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans SC, Microsoft YaHei, Arial"
  panel.style.zIndex = "9999"

  const title = document.createElement("div")
  title.textContent = "Glow 調試"
  title.style.fontSize = "14px"
  title.style.fontWeight = "700"
  title.style.letterSpacing = "0.02em"
  panel.appendChild(title)

  const form = document.createElement("div")
  form.style.display = "grid"
  form.style.gridTemplateColumns = "1fr"
  form.style.gap = "10px"
  form.style.marginTop = "10px"
  panel.appendChild(form)

  const row = (labelText) => {
    const wrap = document.createElement("label")
    wrap.style.display = "grid"
    wrap.style.gridTemplateColumns = "1fr"
    wrap.style.gap = "6px"
    const label = document.createElement("span")
    label.textContent = labelText
    label.style.fontSize = "12px"
    label.style.opacity = "0.9"
    wrap.appendChild(label)
    form.appendChild(wrap)
    return wrap
  }

  const colorRow = row("顏色")
  const color = document.createElement("input")
  color.type = "color"
  color.value = state.color
  color.style.height = "36px"
  colorRow.appendChild(color)

  const opacityRow = row("透明度 (60–80%)")
  const opacity = document.createElement("input")
  opacity.type = "range"
  opacity.min = "0.6"
  opacity.max = "0.8"
  opacity.step = "0.01"
  opacity.value = String(clamp(state.opacity1, 0.6, 0.8))
  opacityRow.appendChild(opacity)

  const blurRow = row("模糊半徑 (6–10px)")
  const blur = document.createElement("input")
  blur.type = "range"
  blur.min = "6"
  blur.max = "10"
  blur.step = "0.1"
  blur.value = String(clamp(state.blur1, 6, 10))
  blurRow.appendChild(blur)

  const footer = document.createElement("div")
  footer.style.display = "flex"
  footer.style.justifyContent = "space-between"
  footer.style.gap = "8px"
  footer.style.marginTop = "10px"
  panel.appendChild(footer)

  const reset = document.createElement("button")
  reset.type = "button"
  reset.textContent = "重置"
  reset.style.flex = "1"
  reset.style.height = "36px"
  reset.style.borderRadius = "8px"
  reset.style.border = "1px solid rgba(255,255,255,0.16)"
  reset.style.background = "rgba(0,0,0,0.18)"
  reset.style.color = "rgba(255,255,255,0.92)"

  const close = document.createElement("button")
  close.type = "button"
  close.textContent = "關閉"
  close.style.flex = "1"
  close.style.height = "36px"
  close.style.borderRadius = "8px"
  close.style.border = "1px solid rgba(255,255,255,0.16)"
  close.style.background = "rgba(0,0,0,0.18)"
  close.style.color = "rgba(255,255,255,0.92)"

  footer.appendChild(reset)
  footer.appendChild(close)

  const apply = () => {
    const rgb = hexToRgb(color.value)
    if (rgb) {
      setCssVar(root, "--event-title-glow-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`)
    }

    const o1 = clamp(Number(opacity.value), 0.6, 0.8)
    const b1 = clamp(Number(blur.value), 6, 10)

    setCssVar(root, "--event-title-glow-opacity-1", o1.toFixed(2))
    setCssVar(root, "--event-title-glow-opacity-2", clamp(o1 - 0.08, 0.4, 0.8).toFixed(2))
    setCssVar(root, "--event-title-glow-opacity-3", clamp(o1 - 0.15, 0.35, 0.8).toFixed(2))
    setCssVar(root, "--event-title-glow-opacity-4", clamp(o1 - 0.2, 0.3, 0.8).toFixed(2))

    setCssVar(root, "--event-title-glow-blur-1", `${b1.toFixed(1)}px`)
    setCssVar(root, "--event-title-glow-blur-2", `${clamp(b1 + 2, 6, 10).toFixed(1)}px`)
    setCssVar(root, "--event-title-glow-blur-3", `${clamp(b1 + 4, 6, 10).toFixed(1)}px`)
    setCssVar(root, "--event-title-glow-blur-4", `${clamp(b1 + 4, 6, 10).toFixed(1)}px`)

    persist(storageKey, {
      color: color.value,
      opacity1: o1,
      blur1: b1,
      opacity4: readNumberStyleVar(getComputedStyle(root), "--event-title-glow-opacity-4", 0.6),
      blur4: readPxStyleVar(getComputedStyle(root), "--event-title-glow-blur-4", 10),
    })
  }

  apply()

  color.addEventListener("input", apply)
  opacity.addEventListener("input", apply)
  blur.addEventListener("input", apply)

  reset.addEventListener("click", () => {
    color.value = defaults.color
    opacity.value = String(clamp(defaults.opacity1, 0.6, 0.8))
    blur.value = String(clamp(defaults.blur1, 6, 10))
    apply()
  })

  close.addEventListener("click", () => {
    panel.remove()
  })

  document.body.appendChild(panel)
  panel.focus()

  return {
    unmount: () => panel.remove(),
  }
}

