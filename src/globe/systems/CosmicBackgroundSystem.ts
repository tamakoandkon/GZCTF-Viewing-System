import * as THREE from 'three'
import gsap from 'gsap'
import { pane } from '../../system/gui'
import domeVertexShader from '../shader/cosmic/dome.vert'
import domeFragmentShader from '../shader/cosmic/dome.frag'
import starpointsVertexShader from '../shader/cosmic/starpoints.vert'
import starpointsFragmentShader from '../shader/cosmic/starpoints.frag'

export interface CosmicOptions {
  isMobile?: boolean
  earthRadius?: number
}

export interface CosmicThemeColors {
  background: string
  primary: string
  secondary: string
}

// 经典宇宙色（哈勃天文摄影风格）
const DARK_THEME = {
  colorBase: '#0a0118', // 近黑紫底
  colorA: '#2d1b69', // 深紫主云
  colorB: '#0891b2', // 青色次云
  colorAccent: '#f59e0b', // 橙金点缀
  nebulaIntensity: 1.0,
  starIntensity: 1.0,
}

const LIGHT_THEME = {
  colorBase: '#141b3c', // 向浅色主题背景提亮靠拢
  colorA: '#3b3a6e', // 去饱和的紫
  colorB: '#2a6f8f', // 去饱和的青
  colorAccent: '#b98a3d', // 去饱和的橙金
  nebulaIntensity: 0.8,
  starIntensity: 0.55,
}

// 银河配色
const GALAXY_INNER = new THREE.Color('#fff7e6') // 暖白
const GALAXY_OUTER = new THREE.Color('#7c3aed') // 紫
const GALAXY_DUST = new THREE.Color('#f59e0b') // 橙金星尘

// 尺寸常量（相机 maxDistance=1200，银河壳层 1300 保证永不遮挡地球）
const DOME_RADIUS = 1400
const GALAXY_RADIUS = 1300

// 星点尺寸分布：幂律 α≈2.4（绝大多数小星尘，极少数大亮星）—— v2 起取代原来的均匀分布
const SIZE_MIN = 0.35
const SIZE_POW = 1 / 2.4
const SIZE_MAX = 2.6
const FLARE_THRESHOLD = 1.65 // 尺寸超过此值的星自动获得十字衍射光芒

interface StarLayer {
  points: THREE.Points
  material: THREE.ShaderMaterial
  speed: number
}

export default class CosmicBackgroundSystem {
  private scene: THREE.Scene
  private earthRadius: number
  private isMobile: boolean
  private densityScale: number

  private group = new THREE.Group()
  private dome: THREE.Mesh | null = null
  private domeUniforms: Record<string, { value: any }> | null = null

  private galaxyGroup = new THREE.Group()
  private galaxyPoints: THREE.Points | null = null
  private galaxyMaterial: THREE.ShaderMaterial | null = null
  private dustPoints: THREE.Points | null = null
  private dustMaterial: THREE.ShaderMaterial | null = null

  private starLayers: StarLayer[] = []
  private glowTexture: THREE.CanvasTexture | null = null

  private elapsed = 0

  private params = {
    visible: true,
    domeVisible: true,
    nebulaIntensity: DARK_THEME.nebulaIntensity,
    galaxyIntensity: 1.0,
    starIntensity: DARK_THEME.starIntensity,
    galaxySpeed: 0.004,
    twinkleSpeed: 1.0,
    starDrift: 1.0, // 差速漂移倍率（0=关闭）
    starSway: 1.0, // 垂直摆动倍率
    flareStrength: 0.55, // 亮星十字光芒强度
  }

  constructor(scene: THREE.Scene, options: CosmicOptions = {}) {
    this.scene = scene
    this.earthRadius = options.earthRadius ?? 100
    this.isMobile =
      options.isMobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    // 密度随视口面积自适应：小屏省算力、大屏更密（钳制 0.75~1.5 倍）
    const area = typeof window !== 'undefined' ? window.innerWidth * window.innerHeight : 1920 * 1080
    this.densityScale = this.isMobile ? 1 : THREE.MathUtils.clamp(area / (1920 * 1080), 0.75, 1.5)
  }

  create(): void {
    this.createDome()
    this.createGalaxy()
    this.createStarLayers()
    this.scene.add(this.group)
    this.registerGUI()
    window.addEventListener('resize', this.handleResize)
  }

  // 分辨率变化（含跨屏拖拽 / dpr 变化）：只更新 uniform，不重建缓冲区
  private handleResize = (): void => {
    const dpr = Math.min(window.devicePixelRatio, 2)
    if (this.galaxyMaterial) this.galaxyMaterial.uniforms.uPixelRatio.value = dpr
    if (this.dustMaterial) this.dustMaterial.uniforms.uPixelRatio.value = dpr
    this.starLayers.forEach(l => {
      l.material.uniforms.uPixelRatio.value = dpr
    })
  }

  // ---------------- 星云穹顶（最底层） ----------------
  private createDome(): void {
    const segments = this.isMobile ? 32 : 64
    const geometry = new THREE.SphereGeometry(DOME_RADIUS, segments, Math.ceil(segments / 2))
    this.domeUniforms = {
      uTime: { value: 0 },
      uColorBase: { value: new THREE.Color(DARK_THEME.colorBase) },
      uColorA: { value: new THREE.Color(DARK_THEME.colorA) },
      uColorB: { value: new THREE.Color(DARK_THEME.colorB) },
      uColorAccent: { value: new THREE.Color(DARK_THEME.colorAccent) },
      uIntensity: { value: this.params.nebulaIntensity },
      uStarGrid: { value: 110.0 }, // 网格越细，"星"越小越接近点状（旧值 40 会把整格渲染成大斑块）
    }
    const material = new THREE.ShaderMaterial({
      vertexShader: domeVertexShader,
      fragmentShader: domeFragmentShader,
      uniforms: this.domeUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      // 移动端 fbm 降为 3 阶
      defines: this.isMobile ? { LOW_QUALITY: '' } : {},
    })
    this.dome = new THREE.Mesh(geometry, material)
    this.dome.renderOrder = -100
    this.dome.frustumCulled = false
    this.group.add(this.dome)
  }

  // ---------------- 银河带（中景，r=1300 壳层倾斜圆环 + 尘埃带） ----------------
  private createGalaxy(): void {
    const count = Math.round((this.isMobile ? 9000 : 24000) * this.densityScale)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)
    const flares = new Float32Array(count)
    const tmpColor = new THREE.Color()

    let i = 0
    while (i < count) {
      const theta = Math.random() * Math.PI * 2
      // 3 组正弦密度调制：伪旋臂簇
      const density =
        0.5 + 0.25 * Math.sin(3 * theta) + 0.15 * Math.sin(5 * theta + 1.7) + 0.1 * Math.sin(7 * theta + 3.4)
      if (Math.random() > density) continue

      // 纬度高斯散布 ±15°（三随机数近似）
      const lat = (((Math.random() + Math.random() + Math.random()) - 1.5) / 1.5) * 0.26
      const r = GALAXY_RADIUS * (1 + (Math.random() - 0.5) * 0.06)

      positions[i * 3] = r * Math.cos(lat) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(lat)
      positions[i * 3 + 2] = r * Math.cos(lat) * Math.sin(theta)

      // 颜色：经度相位 lerp 暖白→紫，10% 橙金星尘
      const phase = (Math.sin(2 * theta) + 1) / 2
      if (Math.random() < 0.1) {
        tmpColor.copy(GALAXY_DUST)
      } else {
        tmpColor.copy(GALAXY_INNER).lerp(GALAXY_OUTER, phase)
      }
      colors[i * 3] = tmpColor.r
      colors[i * 3 + 1] = tmpColor.g
      colors[i * 3 + 2] = tmpColor.b

      // 幂律尺寸：银河带以小颗粒为主，少量大亮点
      const s = Math.min(SIZE_MIN * Math.pow(Math.random(), -SIZE_POW), SIZE_MAX)
      scales[i] = s
      flares[i] = s > FLARE_THRESHOLD ? Math.min(1, (s - FLARE_THRESHOLD) / 0.85) : 0
      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.3 + Math.random() * 1.2
      i++
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geometry.setAttribute('aFlare', new THREE.BufferAttribute(flares, 1))

    this.galaxyMaterial = new THREE.ShaderMaterial({
      vertexShader: starpointsVertexShader,
      fragmentShader: starpointsFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.8 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uTwinkleSpeed: { value: this.params.twinkleSpeed },
        uSizeAtten: { value: 0.0 }, // 固定像素尺寸：壳层点云不随距离放大
        uDrift: { value: 0.0012 }, // 极慢差速：保留旋臂结构不被搅散
        uSway: { value: 0.4 },
        uMinSize: { value: 1.2 },
        uMaxSize: { value: 9.0 },
        uFlareStrength: { value: this.params.flareStrength * 0.6 },
        uTexture: { value: this.getGlowTexture() },
        uIntensity: { value: this.params.galaxyIntensity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.galaxyPoints = new THREE.Points(geometry, this.galaxyMaterial)
    this.galaxyPoints.renderOrder = -90
    this.galaxyPoints.frustumCulled = false
    // 倾斜约 60°，斜跨天幕
    this.galaxyGroup.rotation.set(0.3, 0, Math.PI / 3)
    this.galaxyGroup.add(this.galaxyPoints)

    // ---- 尘埃带：贴着旋臂内侧的暖色薄层，制造前后景层次 ----
    const dustCount = Math.round((this.isMobile ? 2500 : 6500) * this.densityScale)
    const dPos = new Float32Array(dustCount * 3)
    const dCol = new Float32Array(dustCount * 3)
    const dScale = new Float32Array(dustCount)
    const dPhase = new Float32Array(dustCount)
    const dSpeed = new Float32Array(dustCount)
    const dFlare = new Float32Array(dustCount)
    const dustColor = new THREE.Color()

    for (let k = 0; k < dustCount; k++) {
      const theta = Math.random() * Math.PI * 2
      const density =
        0.5 + 0.25 * Math.sin(3 * theta + 0.5) + 0.15 * Math.sin(5 * theta + 2.2)
      if (Math.random() > density) {
        k--
        continue
      }
      // 纬度略偏南 + 半径略小：形成贴着银河的暗暖色窄带
      const lat = (((Math.random() + Math.random() + Math.random()) - 1.5) / 1.5) * 0.12 - 0.03
      const r = GALAXY_RADIUS * (0.972 + (Math.random() - 0.5) * 0.02)
      dPos[k * 3] = r * Math.cos(lat) * Math.cos(theta)
      dPos[k * 3 + 1] = r * Math.sin(lat)
      dPos[k * 3 + 2] = r * Math.cos(lat) * Math.sin(theta)

      dustColor.copy(GALAXY_DUST).lerp(GALAXY_INNER, Math.random() * 0.5)
      dCol[k * 3] = dustColor.r
      dCol[k * 3 + 1] = dustColor.g
      dCol[k * 3 + 2] = dustColor.b

      const s = Math.min(SIZE_MIN * Math.pow(Math.random(), -SIZE_POW), 1.6)
      dScale[k] = s
      dFlare[k] = 0 // 尘埃不带星芒，保持"雾"的观感
      dPhase[k] = Math.random() * Math.PI * 2
      dSpeed[k] = 0.2 + Math.random() * 0.8
    }

    const dustGeometry = new THREE.BufferGeometry()
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dPos, 3))
    dustGeometry.setAttribute('aColor', new THREE.BufferAttribute(dCol, 3))
    dustGeometry.setAttribute('aScale', new THREE.BufferAttribute(dScale, 1))
    dustGeometry.setAttribute('aPhase', new THREE.BufferAttribute(dPhase, 1))
    dustGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(dSpeed, 1))
    dustGeometry.setAttribute('aFlare', new THREE.BufferAttribute(dFlare, 1))

    this.dustMaterial = new THREE.ShaderMaterial({
      vertexShader: starpointsVertexShader,
      fragmentShader: starpointsFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 3.4 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uTwinkleSpeed: { value: this.params.twinkleSpeed * 0.6 },
        uSizeAtten: { value: 0.0 },
        uDrift: { value: 0.0016 },
        uSway: { value: 0.3 },
        uMinSize: { value: 1.5 },
        uMaxSize: { value: 7.0 },
        uFlareStrength: { value: 0.0 },
        uTexture: { value: this.getGlowTexture() },
        uIntensity: { value: 0.55 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.dustPoints = new THREE.Points(dustGeometry, this.dustMaterial)
    this.dustPoints.renderOrder = -89
    this.dustPoints.frustumCulled = false
    this.galaxyGroup.add(this.dustPoints)

    this.group.add(this.galaxyGroup)
  }

  // ---------------- 星点层（近景，5 层视差 + 差速漂移 + 双频闪烁） ----------------
  private createStarLayers(): void {
    // uSize 已按 atten≈300/r 折算：让「典型尺寸」落在目标像素区间
    // 层数/密度：桌面 5 层（近景大星 → 深空星尘），移动端 3 层
    const layerDefs = this.isMobile
      ? [
          { radius: 780, count: 4200, size: 12.0, speed: 0.005, drift: 0.008, sway: 1.2 },
          { radius: 1000, count: 7000, size: 10.0, speed: 0.003, drift: 0.005, sway: 0.9 },
          { radius: 1220, count: 9000, size: 8.5, speed: 0.002, drift: 0.003, sway: 0.6 },
        ]
      : [
          { radius: 620, count: 2200, size: 13.0, speed: 0.006, drift: 0.01, sway: 2.0 },
          { radius: 780, count: 5500, size: 12.0, speed: 0.004, drift: 0.008, sway: 1.6 },
          { radius: 950, count: 9000, size: 11.0, speed: 0.003, drift: 0.006, sway: 1.2 },
          { radius: 1120, count: 13000, size: 9.5, speed: 0.002, drift: 0.004, sway: 0.9 },
          { radius: 1250, count: 12000, size: 8.0, speed: 0.0015, drift: 0.003, sway: 0.6 },
        ]

    const tmpColor = new THREE.Color()
    layerDefs.forEach((def, layerIdx) => {
      const { radius, count: baseCount, size, speed, drift, sway } = def
      const count = Math.round(baseCount * this.densityScale)
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)
      const scales = new Float32Array(count)
      const phases = new Float32Array(count)
      const speeds = new Float32Array(count)
      const flares = new Float32Array(count)

      for (let i = 0; i < count; i++) {
        // 球面均匀分布
        const z = Math.random() * 2 - 1
        const theta = Math.random() * Math.PI * 2
        const rxy = Math.sqrt(1 - z * z)
        positions[i * 3] = radius * rxy * Math.cos(theta)
        positions[i * 3 + 1] = radius * z
        positions[i * 3 + 2] = radius * rxy * Math.sin(theta)

        // 颜色：白 ± 淡蓝/淡黄色温变化
        tmpColor.setHSL(0.55 + (Math.random() - 0.5) * 0.15, Math.random() * 0.35, 0.75 + Math.random() * 0.25)
        colors[i * 3] = tmpColor.r
        colors[i * 3 + 1] = tmpColor.g
        colors[i * 3 + 2] = tmpColor.b

        // 幂律尺寸分布：小星尘为主体，长尾大亮星（自然景深）
        const s = Math.min(SIZE_MIN * Math.pow(Math.random(), -SIZE_POW), SIZE_MAX)
        scales[i] = s
        flares[i] = s > FLARE_THRESHOLD ? Math.min(1, (s - FLARE_THRESHOLD) / 0.85) : 0
        phases[i] = Math.random() * Math.PI * 2
        speeds[i] = 0.4 + Math.random() * 1.6
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
      geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
      geometry.setAttribute('aFlare', new THREE.BufferAttribute(flares, 1))

      const material = new THREE.ShaderMaterial({
        vertexShader: starpointsVertexShader,
        fragmentShader: starpointsFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: size },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uTwinkleSpeed: { value: this.params.twinkleSpeed },
          uSizeAtten: { value: 1.0 }, // 随距离衰减：近大远小的深度感
          uDrift: { value: drift * this.params.starDrift },
          uSway: { value: sway * this.params.starSway },
          uMinSize: { value: 1.6 },
          uMaxSize: { value: 26.0 },
          uFlareStrength: { value: this.params.flareStrength },
          uTexture: { value: this.getGlowTexture() },
          uIntensity: { value: this.params.starIntensity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      const points = new THREE.Points(geometry, material)
      points.renderOrder = -80 + layerIdx * 10
      points.frustumCulled = false
      this.group.add(points)
      this.starLayers.push({ points, material, speed })
    })
  }

  // ---------------- 柔光点精灵纹理（128×128 canvas：锐核 + 宽晕，运行时生成） ----------------
  private getGlowTexture(): THREE.CanvasTexture {
    if (this.glowTexture) return this.glowTexture
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    // 三段式：白热核（0~0.12）→ 亮环（0.35）→ 柔晕拖尾（0.7~1.0）
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.12, 'rgba(255,255,255,0.97)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    grad.addColorStop(0.7, 'rgba(255,255,255,0.12)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.fill()
    this.glowTexture = new THREE.CanvasTexture(canvas)
    this.glowTexture.minFilter = THREE.LinearFilter
    this.glowTexture.magFilter = THREE.LinearFilter
    this.glowTexture.generateMipmaps = false
    return this.glowTexture
  }

  // ---------------- Tweakpane 调试面板 ----------------
  private registerGUI(): void {
    const folder = pane.addFolder({ title: '🌌 宇宙背景' })
    folder.expanded = false
    const p = this.params

    folder.addBinding(p, 'visible').on('change', (ev: any) => {
      this.group.visible = ev.value
    })
    folder.addBinding(p, 'domeVisible', { label: 'domeVisible' }).on('change', (ev: any) => {
      if (this.dome) this.dome.visible = ev.value
    })
    folder.addBinding(p, 'nebulaIntensity', { min: 0, max: 2, step: 0.05 }).on('change', (ev: any) => {
      if (this.domeUniforms) this.domeUniforms.uIntensity.value = ev.value
    })
    folder.addBinding(p, 'galaxyIntensity', { min: 0, max: 2, step: 0.05 }).on('change', (ev: any) => {
      if (this.galaxyMaterial) this.galaxyMaterial.uniforms.uIntensity.value = ev.value
    })
    folder.addBinding(p, 'starIntensity', { min: 0, max: 2, step: 0.05 }).on('change', (ev: any) => {
      this.starLayers.forEach(l => {
        l.material.uniforms.uIntensity.value = ev.value
      })
    })
    folder.addBinding(p, 'galaxySpeed', { min: 0, max: 0.02, step: 0.001 }).on('change', () => {
      /* update() 内直接读取 params.galaxySpeed */
    })
    folder.addBinding(p, 'twinkleSpeed', { min: 0, max: 3, step: 0.1 }).on('change', () => {
      /* update() 内同步到各 uniform */
    })
    folder.addBinding(p, 'starDrift', { label: 'starDrift', min: 0, max: 3, step: 0.1 }).on('change', () => {
      /* 漂移速率在创建时写入 uniform，如需实时调节见 setDrift() */
    })
    folder.addBinding(p, 'starSway', { label: 'starSway', min: 0, max: 3, step: 0.1 }).on('change', () => {
      /* 摆动幅度在创建时写入 uniform */
    })
    folder.addBinding(p, 'flareStrength', { label: 'flareStrength', min: 0, max: 1.5, step: 0.05 }).on('change', (ev: any) => {
      this.starLayers.forEach(l => {
        l.material.uniforms.uFlareStrength.value = ev.value
      })
    })
  }

  // ---------------- 主题适配（themeChange 事件驱动） ----------------
  setTheme(colors: CosmicThemeColors, isDark: boolean): void {
    const t = isDark ? DARK_THEME : LIGHT_THEME
    const target = {
      base: new THREE.Color(t.colorBase),
      a: new THREE.Color(t.colorA),
      b: new THREE.Color(t.colorB),
      accent: new THREE.Color(t.colorAccent),
    }
    // 浅色主题：底色与页面背景色融合提亮
    if (!isDark) {
      target.base.lerp(new THREE.Color(colors.background), 0.35)
    }

    if (this.domeUniforms) {
      this.tweenColor(this.domeUniforms.uColorBase.value, target.base)
      this.tweenColor(this.domeUniforms.uColorA.value, target.a)
      this.tweenColor(this.domeUniforms.uColorB.value, target.b)
      this.tweenColor(this.domeUniforms.uColorAccent.value, target.accent)
      gsap.to(this.domeUniforms.uIntensity, { value: t.nebulaIntensity, duration: 0.8, ease: 'power2.out' })
      // 同步调试面板参数
      this.params.nebulaIntensity = t.nebulaIntensity
    }

    this.starLayers.forEach(l => {
      gsap.to(l.material.uniforms.uIntensity, { value: t.starIntensity, duration: 0.8, ease: 'power2.out' })
    })
    this.params.starIntensity = t.starIntensity
  }

  private tweenColor(from: THREE.Color, to: THREE.Color): void {
    gsap.killTweensOf(from)
    gsap.to(from, { r: to.r, g: to.g, b: to.b, duration: 0.8, ease: 'power2.out' })
  }

  // ---------------- 帧更新（仅写入少量 uniform，无逐粒子 CPU 开销） ----------------
  update(delta: number): void {
    this.elapsed += delta

    if (this.domeUniforms) {
      this.domeUniforms.uTime.value = this.elapsed
    }
    if (this.galaxyPoints) {
      this.galaxyPoints.rotation.y += delta * this.params.galaxySpeed
    }
    if (this.galaxyMaterial) {
      this.galaxyMaterial.uniforms.uTime.value = this.elapsed
      this.galaxyMaterial.uniforms.uTwinkleSpeed.value = this.params.twinkleSpeed
    }
    if (this.dustMaterial) {
      this.dustMaterial.uniforms.uTime.value = this.elapsed
    }
    this.starLayers.forEach(l => {
      l.points.rotation.y += delta * l.speed
      l.material.uniforms.uTime.value = this.elapsed
      l.material.uniforms.uTwinkleSpeed.value = this.params.twinkleSpeed
    })
  }

  // ---------------- 清理 ----------------
  dispose(): void {
    window.removeEventListener('resize', this.handleResize)

    this.starLayers.forEach(l => {
      this.group.remove(l.points)
      l.points.geometry.dispose()
      l.material.dispose()
    })
    this.starLayers = []

    if (this.galaxyPoints && this.galaxyMaterial) {
      this.galaxyGroup.remove(this.galaxyPoints)
      this.galaxyPoints.geometry.dispose()
      this.galaxyMaterial.dispose()
      this.galaxyPoints = null
      this.galaxyMaterial = null
    }

    if (this.dustPoints && this.dustMaterial) {
      this.galaxyGroup.remove(this.dustPoints)
      this.dustPoints.geometry.dispose()
      this.dustMaterial.dispose()
      this.dustPoints = null
      this.dustMaterial = null
    }

    if (this.dome) {
      this.group.remove(this.dome)
      this.dome.geometry.dispose()
      ;(this.dome.material as THREE.Material).dispose()
      this.dome = null
      this.domeUniforms = null
    }

    this.glowTexture?.dispose()
    this.glowTexture = null

    this.scene.remove(this.group)
  }
}
