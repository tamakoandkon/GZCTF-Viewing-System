# GZCTF Spectator System — 开发文档

> 本文档面向开发者，详细介绍系统架构、核心模块设计、数据流和开发指南。

---

## 目录

1. [系统架构概览](#1-系统架构概览)
2. [项目结构详解](#2-项目结构详解)
3. [核心模块设计](#3-核心模块设计)
   - [3.1 3D 场景引擎 (scene.js)](#31-3d-场景引擎-scenejs)
   - [3.2 地球渲染系统 (Earth-github.js)](#32-地球渲染系统-earth-githubjs)
   - [3.3 飞船系统 (Spaceship)](#33-飞船系统-spaceship)
   - [3.4 飞船管理器 (SpaceshipManager)](#34-飞船管理器-spaceshipmanager)
   - [3.5 攻击特效系统](#35-攻击特效系统)
   - [3.6 运镜系统 (CameraDirector)](#36-运镜系统-cameradirector)
   - [3.7 自动展示系统 (AutoShowcaseSystem)](#37-自动展示系统-autoshowcasesystem)
4. [前端数据流](#4-前端数据流)
5. [API 服务层](#5-api-服务层)
6. [国家-Category 映射系统](#6-国家-category-映射系统)
7. [性能优化策略](#7-性能优化策略)
8. [开发指南](#8-开发指南)
9. [常见问题](#9-常见问题)

---

## 1. 系统架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (Next.js)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  App Layer (React)                     │   │
│  │  ScoreboardPage → InteractiveArena → SceneController  │   │
│  │       ↑                    ↑                          │   │
│  │  TeamRankings       3D Engine Bridge                  │   │
│  │  EventsFeed                                          │   │
│  │  TopTeamsAbility                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │                 Services Layer                         │   │
│  │  auth-service | scoreboard | events | game | challenge │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │               3D Engine (Three.js)                     │   │
│  │                                                        │   │
│  │  scene.js ─── Earth ─── SpaceshipManager ─── Camera   │   │
│  │                │              │                        │   │
│  │            Country       Spaceships                    │   │
│  │            Labels        Attacks                       │   │
│  │            Effects      Explosions                     │   │
│  │                                                        │   │
│  │  System: GUI | Sizes | Resize | Pointer | PerfRecorder │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    GZCTF Backend API     │
              │  (via Next.js Rewrites)  │
              └─────────────────────────┘
```

### 技术分层

| 层级 | 技术 | 职责 |
|------|------|------|
| **页面层** | Next.js App Router | 路由、布局、数据获取 |
| **组件层** | React + TypeScript | UI 组件、状态管理 |
| **服务层** | TypeScript fetch API | 数据获取、认证、转换 |
| **3D 引擎层** | Three.js + postprocessing | 场景渲染、特效、动画 |
| **系统工具层** | JS utilities | GUI、性能、交互 |

---

## 2. 项目结构详解

### `app/` — Next.js App Router

| 路径 | 说明 |
|------|------|
| `app/page.tsx` | 首页，重定向到默认比赛记分板 |
| `app/layout.tsx` | 根布局，主题 Provider |
| `app/login/page.tsx` | 管理员登录页 |
| `app/scoreboard/[gameId]/page.tsx` | **核心页面**：记分板 + 3D 竞技场 |
| `app/design/` | 设计预览页（标题 Demo、发光画廊） |

记分板页面采用**三栏响应式布局**：

```
┌──────────┬───────────────────┬──────────┐
│ Rankings │  3D Interactive   │ Events   │
│ (1/4)    │  Arena (flex-1)   │ + Top3   │
│          │                   │ (1/6)    │
└──────────┴───────────────────┴──────────┘
```

- 排名列表每 15 秒轮换分组（每组 10 队）
- 每 15 秒重新获取全部数据

### `components/` — React 组件

| 组件 | 文件 | 说明 |
|------|------|------|
| **InteractiveArena** | `interactive-arena.tsx` | 3D 场景的 React 桥接，管理 Three.js 生命周期 |
| **TeamRankings** | `team-rankings.tsx` | 排名列表，带分数差距显示 |
| **EventsFeed** | `events-feed.tsx` | 事件流（Flag 提交记录） |
| **TopTeamsAbility** | `top-teams-ability.tsx` | TOP3 雷达图 |
| **CountdownTimer** | `countdown-timer.tsx` | 比赛倒计时 |
| **CompetitionTitle** | `competition-title.tsx` | 霓虹发光标题 |
| **AdminLogin** | `admin-login.tsx` | 登录表单 |
| **SettingsPanel** | `settings-panel.tsx` | 设置面板（GUI 切换等） |
| **RotationStatus** | `rotation-status.tsx` | 分组轮换进度条 |

### `src/` — 3D 引擎核心

| 模块 | 文件 | 行数（约） | 说明 |
|------|------|-----------|------|
| 场景 | `scene.js` | ~600 | 场景初始化、相机、光照、主循环 |
| 地球 | `globe/Earth-github.js` | ~2700 | 地球渲染、国家边界/填充、标签 |
| 飞船 | `globe/Spaceship.js` | ~500 | 飞船模型、标签、轨道运动 |
| 管理器 | `globe/SpaceshipManager.js` | ~2200 | 飞船生命周期、攻击系统、特效 |
| 运镜 | `globe/CameraDirector.js` | ~400 | 运镜预设、序列管理 |
| 展示 | `globe/AutoShowcaseSystem.js` | ~350 | 自动展示调度 |
| 后处理 | `effect.js` | ~100 | Bloom 等后处理特效 |

---

## 3. 核心模块设计

### 3.1 3D 场景引擎 (scene.js)

#### 初始化流程

```
initScene()
  ├─ 创建 THREE.Scene + 背景色
  ├─ 创建 PerspectiveCamera (FOV=75)
  ├─ 创建 OrbitControls (阻尼、最大/最小距离)
  ├─ 添加灯光（Ambient + Directional + Fill）
  ├─ 加载环境贴图（HDR）
  ├─ 创建 EffectComposer（Bloom 后处理）
  ├─ 初始化 GUI（Tweakpane，默认隐藏）
  ├─ 加载地球实例（Earth-github.js）
  │   ├─ 创建国家边界线（176 个）
  │   ├─ 创建国家填充（45 个 Polygon 大国）
  │   ├─ 创建飞线系统
  │   └─ 创建航班系统
  ├─ 创建 SpaceshipManager
  ├─ 创建 CameraDirector
  ├─ 创建 AutoShowcaseSystem
  └─ 启动主循环 animate()
```

#### 主循环 (animate)

```
每帧执行：
  1. stats.begin()
  2. 计算 delta
  3. 更新 OrbitControls
  4. 更新地球 (earth.update) — 旋转、着色器 uniforms、标签朝向
  5. 更新 SpaceshipManager — 飞船位置、攻击动画、爆炸特效
  6. 更新深度排序
  7. 渲染（EffectComposer.render 或 renderer.render）
  8. stats.end()
```

#### 关键配置

```javascript
// 相机
camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000)
camera.position.set(0, 0, 8)

// OrbitControls
controls.maxDistance = 1200
controls.minDistance = 20
controls.autoRotateSpeed = 0.5
controls.target.set(0, 0, 0)
```

### 3.2 地球渲染系统 (Earth-github.js)

#### 概述

基于 Three.js 的高精度 3D 地球系统，从 GeoJSON 数据构建国家几何体。

#### 核心功能

**1. 国家渲染 — 双层策略**

```javascript
// 第一层：所有 176 个国家的边界线
// 使用 LineBasicMaterial + LineSegments
createCountries() {
    features.forEach(feature => {
        const geometry = extractBoundaryGeometry(feature)
        const borderMesh = new LineSegments(geometry, borderMaterial)
        countriesGroup.add(borderMesh)
    })
}

// 第二层：45 个 Polygon 大国的填充
// 使用 Earcut 三角剖分 + MeshBasicMaterial
selectedCountries.forEach(name => {
    const feature = getCountryFeature(name)
    const fillMesh = createPolygonFill(feature)
    countriesGroup.add(fillMesh)
})
```

**2. 国家选择策略**

- **Polygon 类型**：149 个 → 筛选出 45 个顶点数 > 45 的大国
- **MultiPolygon 类型**：27 个（如中国、美国、俄罗斯）→ 只显示边界
- **有内环**：1 个（南非，含莱索托洞）→ 只显示边界
- **小国**：约 103 个 → 只显示边界

**3. 三角剖分算法**

```javascript
createPolygonFill(outerRing, countryName, fillColor, fillOpacity) {
    // 1. 计算多边形中心（质心）
    const center = calculateCenter(outerRing)

    // 2. 建立局部坐标系（切向量 + 副切向量）
    const normal = center.normalize()
    const tangent = cross(normal, up).normalize()
    const bitangent = cross(normal, tangent).normalize()

    // 3. 3D → 2D 投影
    const points2D = outerRing.map(p => {
        const rel = sub(p, center)
        return [dot(rel, tangent), dot(rel, bitangent)]
    })

    // 4. Earcut 三角剖分
    const indices = earcut(points2D.flat())

    // 5. 创建 BufferGeometry
    const geometry = createGeometry(vertices3D, indices)

    // 6. 创建填充 Mesh
    const material = new THREE.MeshBasicMaterial({
        color: fillColor,
        opacity: fillOpacity,
        transparent: true,
        side: DoubleSide,
        depthWrite: false
    })
    return new THREE.Mesh(geometry, material)
}
```

**4. 材质分离**

边界线和填充使用**完全独立的材质实例**，解决透明度联动问题：

```
边界材质 (LineBasicMaterial) → polygonOpacity（可独立调节）
填充材质 (MeshBasicMaterial) → fillOpacity = 0.1（固定，不受边界影响）
```

**5. Challenge 类别标签**

```javascript
addCountryLabel(countryName, labelText, color) {
    // 1. 获取国家几何中心
    const center = getCountryGeometryCenter(countryName)

    // 2. Canvas 绘制文本纹理（96px 粗体 + 黑色描边）
    const texture = createTextTexture(labelText, 96, color)

    // 3. 创建 Sprite（始终面向相机）
    const sprite = new THREE.Sprite(new SpriteMaterial({
        map: texture,
        depthTest: false,  // 始终可见
        transparent: true,
        opacity: 0.9
    }))

    // 4. 设置位置（国家上方 12 单位）和大小
    sprite.position.copy(center).add(center.normalize().multiplyScalar(12))
    sprite.scale.set(baseScale, baseScale / 3.5, 1)
}
```

**6. 材质管理器**

使用 `MaterialManager` 复用相同配置的材质，避免 GPU 内存泄漏（减少 60% 重复创建）。

#### 关键方法索引

| 方法 | 行号（约） | 说明 |
|------|-----------|------|
| `constructor()` | 1 | 初始化配置、材质管理器 |
| `createCountries()` | 200 | 双层国家渲染主入口 |
| `processPolygonGroup()` | 600 | 处理复杂多边形（含洞） |
| `createPolygonFill()` | 800 | Earcut 三角剖分填充 |
| `createCountryLabel()` | 2500 | 创建 Challenge 标签 |
| `getCountryGeometryCenter()` | 2350 | 计算国家几何中心 |
| `getCountry3DPosition()` | 2400 | 经纬度 → 3D 坐标 |
| `highlightCountry()` | 2600 | 国家高亮 |
| `update(delta, camera)` | 2700 | 每帧更新 |
| `dispose()` | 2800 | 资源清理 |

### 3.3 飞船系统 (Spaceship.js)

#### 概述

每艘飞船代表一个参赛队伍，在 3D 空间中沿固定轨道绕地球飞行。

#### 轨道位置系统

基于**排名固定位置映射**，每个排名对应唯一天体位置：

```
排名 → 轨道层 + 角度偏移
  1-3:  低轨道 (r=196),  120° 间隔, 高度 +20
  4-9:  中轨道 (r=238),  60° 间隔,  高度 0
  10-20: 高轨道 (r=280),  均分,      高度 -20
```

```javascript
// Spaceship.js 轨道更新
updateOrbit(delta) {
    // 角度累加（帧率无关，使用 delta）
    this.angle += this.orbitSpeed * delta

    // 平滑过渡目标角度偏移
    if (this.targetOrbitOffset !== undefined) {
        const diff = normalizeAngle(this.targetOrbitOffset - this.orbitOffset)
        this.orbitOffset += diff * transitionSpeed
    }

    // 计算 3D 位置
    const theta = this.angle + this.orbitOffset
    const x = this.orbitRadius * Math.cos(theta)
    const z = this.orbitRadius * Math.sin(theta)
    const y = this.orbitHeight

    this.position.set(x, y, z)
    this.lookAt(0, y, 0)
}
```

#### 飞船标签

使用 Canvas 动态渲染的 Sprite 标签，始终面向相机：

```javascript
createTeamLabel() {
    // Canvas 尺寸根据队名长度自适应
    canvas.width = Math.max(800, teamName.length * 60)

    // 固定大字体（不受缩放影响）
    ctx.font = 'bold 60px Arial'   // 队名
    ctx.font = 'bold 50px Arial'   // 排名
    ctx.font = 'bold 40px Arial'   // 分数

    // Sprite 缩放（排名越高越大）
    const labelScale = rankMultiplier * 2.5
    sprite.scale.set(
        size * labelScale * aspect * 0.8,
        size * labelScale * 0.8,
        1
    )
}
```

#### 排名过渡

当队伍排名变化时：

1. 设置 `targetOrbitOffset` 为目标排名对应的角度
2. 使用 `transitionSpeed`（提升 0.15 / 下降 0.08 / 默认 0.05）平滑过渡
3. 角度环绕处理：从 350° 到 10° 走最短路径（20° 而非 -340°）

#### 模型大小

缩小排名间差距，视觉更协调：

```javascript
const rankMultiplier =
    rank <= 3
        ? rank === 1 ? 1.3
        : rank === 2 ? 1.2
        : 1.1
        : 1.0
```

### 3.4 飞船管理器 (SpaceshipManager.js)

#### 概述

管理系统中的所有飞船、攻击动画和爆炸特效。

#### 构造函数

```javascript
constructor(earth, scene) {
    this.earth = earth
    this.scene = scene
    this.spaceships = new Map()       // teamId → Spaceship
    this.attacks = []                 // 活跃攻击列表
    this.explosions = []              // 爆炸特效列表
    this.explosionIdCounter = 0
    this.lastCameraPosition = null
    this.lastDepthSortTime = 0
    this.maxShips = 20                // 桌面端（移动端 15）
    this.maxUpdatesPerFrame = 8       // 分帧更新
}
```

#### 团队更新流程

```javascript
updateTeams(teams) {
    // 1. 检测变化（避免不必要重建）
    const hasChanges = detectTeamChanges(teams)

    if (!hasChanges) return

    // 2. 只保留前 20 名的队伍
    const topTeams = teams
        .sort((a, b) => a.rank - b.rank)
        .slice(0, this.maxShips)

    // 3. 处理新飞船创建
    topTeams.forEach(team => {
        if (!this.spaceships.has(team.id)) {
            this.createSpaceshipAtRank(team)
        }
    })

    // 4. 处理排名变化
    topTeams.forEach(team => {
        const ship = this.spaceships.get(team.id)
        if (ship.rank !== team.rank) {
            ship.targetOrbitOffset = getRankPosition(team.rank).orbitOffset
        }
    })

    // 5. 清理超出排名的飞船
    this.removeShipsOutsideTopN()
}
```

#### 深度排序

使用点积判断飞船在地球前方还是后方：

```javascript
updateDepthSorting(camera) {
    this.spaceships.forEach(ship => {
        const camToEarth = sub(earthCenter, camera.position).normalize()
        const shipToEarth = sub(earthCenter, ship.position).normalize()
        const dot = dotProduct(camToEarth, shipToEarth)

        // dot < 0: 飞船在地球后面 → 先渲染
        // dot > 0: 飞船在地球前面 → 后渲染
        ship.renderOrder = dot < 0 ? 0 : 2
    })
}
```

#### 分帧更新

避免单帧计算量过大，每次只更新部分飞船：

```javascript
update(delta) {
    // 分帧更新飞船
    const startIdx = this.updateIndex
    const endIdx = Math.min(startIdx + this.maxUpdatesPerFrame, ships.length)

    for (let i = startIdx; i < endIdx; i++) {
        ships[i].update(delta)
    }

    this.updateIndex = endIdx >= ships.length ? 0 : endIdx
}
```

### 3.5 攻击特效系统

#### 随机选择机制

每次 `createAttack()` 被调用时随机选择攻击类型：

```javascript
createAttack(fromTeamId, targetCountry, challengeInfo) {
    const attackType = Math.floor(Math.random() * 4) + 1
    // 1 = 闪电链, 2 = 能量波纹, 3 = 传送门, 4 = 粒子洪流

    const attack = {
        id: generateId(),
        fromSpaceship: this.spaceships.get(fromTeamId),
        toPosition: this.earth.getCountryGeometryCenter(targetCountry),
        targetCountry,
        challengeInfo,
        progress: 0,
        startTime: Date.now(),
        duration: 2500,
        attackType,
        pathPoints: this.calculateAttackPath(fromPos, toPos),
        objects: []
    }

    this.attacks.push(attack)
}
```

#### 四种攻击类型实现

**1. 闪电链 (Lightning)**
```javascript
createLightningAttack(attack) {
    // 创建折线 BufferGeometry，20 个路径点
    // 材质：LineBasicMaterial，线宽 3
    // 更新时每 50ms 重新生成路径（加入随机偏移 ±15）
    // 30% 概率闪烁（降低不透明度）
}
```

**2. 能量波纹 (Energy Wave)**
```javascript
createEnergyWaveAttack(attack) {
    // 能量球：SphereGeometry(r=3) + 旋转动画
    // 3 个波纹环：RingGeometry + 扩散动画（1→4 倍）
    // 脉动效果：sin 函数调制球大小
    // 透明度：0.6/0.4/0.2 递减
}
```

**3. 传送门 (Portal)**
```javascript
createPortalAttack(attack) {
    // 四阶段动画：
    //   0-20%：起点传送门打开（Torus + Circle + 粒子）
    //   20-60%：能量束穿越（Cylinder）
    //   60-80%：目标传送门打开
    //   80-100%：能量射出 + 爆炸
    // 传送门：半径 8/管 1 的环 + 光晕 + 50 个环绕粒子
}
```

**4. 粒子洪流 (Particle Flood)**
```javascript
createParticleFloodAttack(attack) {
    // 200 个粒子：SphereGeometry 点精灵
    // 每个粒子速度略有差异（0.8-1.2 倍基础速度）
    // 添加随机扰动（±0.5）模拟流动感
    // 颜色略有差异（70-100% 亮度）
}
```

#### 弧形路径算法

确保攻击不穿过地球：

```javascript
calculateAttackPath(startPos, endPos) {
    const startDist = startPos.length()    // 飞船到地心距离
    const endDist = endPos.length()        // 目标到地心距离
    const earthRadius = this.earth.config.radius

    if (startDist < earthRadius * 1.2 && endDist < earthRadius * 1.2) {
        // 都在近地 → 使用弧形路径
        return createArcPath(startPos, endPos, earthCenter, earthRadius)
    } else {
        // 飞船在轨道外 → 使用直线
        return createLinearPath(startPos, endPos)
    }
}

createArcPath(startPos, endPos, earthCenter, earthRadius) {
    // 1. 计算安全高度
    const safeHeight = Math.max(
        earthRadius * 0.4,         // 至少 40% 地球半径
        startEndDistance * 0.3      // 或 30% 路径长度
    )

    // 2. 控制点向外推
    const midpoint = mid(startPos, endPos)
    const controlPoint = midpoint.normalize()
        .multiplyScalar(earthRadius + safeHeight)

    // 3. 二次贝塞尔曲线，30 个分段
    // 4. 验证每个点都在地球外部
    return bezierPoints
}
```

#### 爆炸特效

攻击命中后的视觉效果：

```javascript
createCleanExplosionEffect(position, isSuccess, category) {
    const color = getChallengeColor(category)

    // 创建 3 个扩散波纹环
    const rings = Array.from({length: 3}, (_, i) => {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.5 + i * 0.3, 1 + i * 0.3, 32),
            new MeshBasicMaterial({color, transparent: true, opacity: 0.8})
        )
        ring.scale.set(0, 0, 0)  // 初始不可见
        return ring
    })

    // 创建 15 个粒子
    const particleSystem = createParticleExplosion(position, color, 15)

    // 添加到管理数组
    this.explosions.push({
        id: this.explosionIdCounter++,
        rings, particleSystem,
        startTime: Date.now(),
        duration: 800  // 0.8 秒
    })
}
```

#### 特效生命周期

```
attack 创建 → updateAttacks(delta) → progress 达到 1.0
    ↓
completeAttack(attack)
    ├─ createCleanExplosionEffect()
    ├─ 清理攻击对象（几何体、材质）
    └─ earth.highlightCountry()
    ↓
updateExplosions(delta)  // 每帧更新所有爆炸
    ├─ progress < 1: 更新动画（扩散、淡出）
    └─ progress >= 1: 清理资源、从数组移除
```

### 3.6 运镜系统 (CameraDirector.js)

#### 概述

管理相机运镜序列，提供电影级镜头切换效果。

#### 5 种运镜模式

```javascript
const CAMERA_PRESETS = {
    orbit: {
        name: '环绕地球',
        duration: 10,
        keyframes: [
            { time: 0, position: {...}, target: {...} },
            { time: 10, position: {...}, target: {...} }
        ]
    },
    zoomIn: {
        name: '推进特写',
        duration: 8,
        // 从远处 Zoom 到近景
    },
    dive: {
        name: '俯冲运镜',
        duration: 12,
        // 模拟从高空俯冲
    },
    spiral: {
        name: '螺旋上升',
        duration: 15,
        // 螺旋上升轨迹
    },
    followSpaceship: {
        name: '跟随飞船',
        duration: 8,
        // 跟随第一名飞船移动
    }
}
```

#### 运镜执行流程

```javascript
executeSequence(presetName) {
    const preset = this.presets.get(presetName)

    // 1. 计算所有关键帧
    const keyframes = this.generateKeyframes(preset)

    // 2. 使用 GSAP 时间线执行
    const timeline = gsap.timeline()
    keyframes.forEach(kf => {
        timeline.to(camera.position, {
            x: kf.position.x,
            y: kf.position.y,
            z: kf.position.z,
            duration: kf.duration,
            ease: kf.ease || 'power2.inOut',
            onUpdate: () => camera.lookAt(kf.target)
        })
    })

    // 3. 运镜结束时恢复用户控制
    timeline.eventCallback('onComplete', () => {
        this.isCinematic = false
        controls.enabled = true
    })

    // 4. 暂时禁用用户控制
    controls.enabled = false
    this.isCinematic = true
}
```

### 3.7 自动展示系统 (AutoShowcaseSystem.js)

#### 概述

自动定时展示 TOP3 飞船和轮换运镜模式。

#### 调度逻辑

```javascript
class AutoShowcaseSystem {
    constructor(spaceshipManager, cameraDirector) {
        this.top3Interval = 5 * 60 * 1000    // 5 分钟展示 TOP3
        this.cameraInterval = 3 * 60 * 1000  // 3 分钟换运镜
        this.minGap = 10 * 1000              // 最小间隔 10 秒
    }

    start() {
        this.top3Timer = setInterval(() => {
            if (!this.isShowcasing && !this.isRotatingCamera) {
                this.triggerTop3Showcase()
            } else {
                setTimeout(() => this.triggerTop3Showcase(), 5000)
            }
        }, this.top3Interval)

        this.cameraTimer = setInterval(() => {
            if (!this.isShowcasing && !this.isRotatingCamera) {
                this.triggerCameraRotation()
            }
        }, this.cameraInterval)
    }
}
```

---

## 4. 前端数据流

### 数据获取架构

```
ScoreboardPage (server component)
  │
  ├─ useEffect → 每 15s 获取数据
  │   ├─ getScoreboard(gameId)     → ScoreboardResponse
  │   ├─ getEvents(gameId)         → EventsResponse
  │   ├─ getGameDetail(gameId)     → GameDetail
  │   └─ getGameDetails(gameId)    → GameDetails
  │
  ├─ scoreboard.items → 所有队伍
  │   ├─ TeamRankings: teams（当前分组 10 个）
  │   ├─ InteractiveArena: allTeams（全部队伍）
  │   │   ├─ SpaceshipManager.updateTeams(allTeams)
  │   │   └─ 3D 场景飞船更新
  │   └─ TopTeamsAbility: TOP3
  │
  └─ events → EventsFeed + InteractiveArena
      ├─ EventsFeed: 显示最近事件
      └─ InteractiveArena: 触发攻击动画
```

### 事件驱动攻击触发

```javascript
// InteractiveArena 中监听 events 变化
useEffect(() => {
    if (!events || events.length === 0) return

    // 获取新事件（时间戳大于上次处理时间）
    const newEvents = events.filter(e =>
        new Date(e.time).getTime() > lastEventTime
    )

    newEvents.forEach(event => {
        const spaceshipManager = globeControllerRef.current
            ?.getSpaceshipManager()

        if (spaceshipManager && event.type === 'flag_submit') {
            const team = allTeams.find(t => t.name === event.teamName)
            const mapping = categoryMappings[event.challengeCategory]
            const targetCountry = mapping?.country

            spaceshipManager.createAttack(
                team?.id,
                targetCountry,
                {
                    challengeCategory: event.challengeCategory,
                    challengeTitle: event.challengeTitle,
                    isSuccess: event.isSuccess
                }
            )
        }
    })

    setLastEventTime(Date.now())
}, [events])
```

### 数据流图

```
GZCTF API
  │
  ├─ GET /api/game/{id}/scoreboard
  │   └─→ { items: [{ rank, name, score, ... }] }
  │       └─→ allTeams / currentGroupTeams
  │           ├─→ TeamRankings (UI)
  │           ├─→ TopTeamsAbility (UI)
  │           └─→ SpaceshipManager (3D)
  │
  ├─ GET /api/game/{id}/events
  │   └─→ [{ type, teamName, challengeCategory, ... }]
  │       ├─→ EventsFeed (UI)
  │       └─→ Attack Trigger (3D)
  │
  ├─ GET /api/game/{id}
  │   └─→ { title, start, end, ... }
  │       ├─→ CompetitionTitle
  │       └─→ CountdownTimer
  │
  └─ GET /api/game/{id}/details
      └─→ { challenges: [...] }
          └─→ categoryMappings
```

---

## 5. API 服务层

### 认证服务 (auth-service.ts)

```typescript
// GZCTF Cookie-based 认证
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export async function login(credentials: LoginCredentials) {
    const response = await fetch(`${BASE_URL}/api/account/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // 关键：接收服务器 Cookie
        body: JSON.stringify(credentials)
    })
    // 保存状态到 localStorage
}

export async function authenticatedFetch(url: string, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: 'include',  // 自动发送 Cookie
    })

    if (response.status === 401) {
        clearAuth()
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return response
}
```

### 数据服务

所有数据服务均使用 `authenticatedFetch` 进行请求，自动携带 GZCTF Cookie：

| 服务 | 文件 | 端点 | 轮询间隔 |
|------|------|------|----------|
| scoreboard | `scoreboard-service.ts` | `/api/game/{id}/scoreboard` | 15s |
| events | `events-service.ts` | `/api/game/{id}/events` | 15s |
| game | `game-service.ts` | `/api/game/{id}` | 15s |
| challenge | `challenge-service.ts` | `/api/game/{id}/details` | 15s |

### Next.js API 代理

`next.config.mjs` 配置代理：

```javascript
async rewrites() {
    return [{
        source: '/api/:path*',
        destination: 'http://43.161.239.75:36306/api/:path*',
    }]
}
```

---

## 6. 国家-Category 映射系统

将 CTF Challenge 类别映射到 3D 地球上的国家：

```typescript
// services/category-mapping-service.ts

const CATEGORY_COUNTRY_MAPPING = {
    Web:        { country: 'India',        color: '#ff6b6b' },
    Crypto:     { country: 'Germany',      color: '#4ecdc4' },
    Pwn:        { country: 'Kazakhstan',   color: '#45b7d1' },
    Reverse:    { country: 'Ukraine',      color: '#96ceb4' },
    Blockchain: { country: 'Thailand',     color: '#feca57' },
    Forensics:  { country: 'Brazil',       color: '#ff9ff3' },
    Hardware:   { country: 'Iran',         color: '#54a0ff' },
    Mobile:     { country: 'Saudi Arabia', color: '#5f27cd' },
    PPC:        { country: 'Spain',        color: '#00d2d3' },
    AI:         { country: 'Mexico',       color: '#ff6348' },
    Pentest:    { country: 'Algeria',      color: '#2ed573' },
    OSINT:      { country: 'Ethiopia',     color: '#ffa502' },
    Misc:       { country: 'Mongolia',     color: '#ff7675' },
}
```

映射要求：
- 所有映射国家必须是 45 个精选 Polygon 大国之一
- 保持地域平衡（覆盖亚/欧/南美/非洲）
- 颜色与类别视觉匹配

---

## 7. 性能优化策略

### 渲染优化

| 策略 | 位置 | 效果 |
|------|------|------|
| 分帧更新飞船 | SpaceshipManager | 每帧 8 个，避免卡顿 |
| 深度排序节流 | SpaceshipManager | 每 5% 帧执行，非每帧 |
| 材质复用 | Earth-github MaterialManager | 减少 60% 重复材质 |
| Earcut 缓冲 | Earth-github | 三角剖分结果缓存 |
| 粒子限制 | 各种攻击效果 | 闪电 0 / 传送门 100 / 洪流 200 |

### 设备自适应

```javascript
// InteractiveArena 初始化时检测
const deviceCapabilities = {
    isMobile: checkMobile(),
    isTablet: checkTablet(),
    pixelRatio: Math.min(window.devicePixelRatio, 2),

    // 移动端降级
    maxParticles: isMobile ? 75 : 150,
    maxStars: isMobile ? 150 : 250,
    renderQuality: isMobile ? 0.5 : 1,
    enableComplexEffects: !isMobile
}

// SpaceshipManager
this.maxShips = isMobile ? 15 : 20
this.maxUpdatesPerFrame = isMobile ? 3 : 8
```

### 内存管理

```javascript
// 每个 dispose() 方法必须完整清理：
1. geometry.dispose()
2. material.dispose()
3. texture.dispose()
4. scene.remove(mesh)
5. 取消事件监听器（使用保存的引用）
6. clearInterval/clearTimeout
```

---

## 8. 开发指南

### 环境要求

- **Node.js**: >= 18
- **npm**: >= 9
- **浏览器**: Chrome 90+ / Firefox 90+ / Safari 15+

### 本地开发

```bash
# 1. 克隆项目
cd myctfv0.33

# 2. 安装依赖
npm install

# 3. 配置环境变量
echo 'NEXT_PUBLIC_API_BASE_URL=http://your-gzctf-server' > .env.local

# 4. 启动开发服务器
npm run dev

# 5. 访问
# 首页: http://localhost:3000
# 记分板: http://localhost:3000/scoreboard/9
```

### 调试技巧

**1. GUI 调试面板**

按 `G` 键或通过 Settings → Toggle GUI 显示 Tweakpane 面板，包含：
- 场景参数（背景色、模糊度）
- 地球渲染参数
- 自动旋转控制
- 性能录制

**2. 浏览器控制台**

```javascript
// 获取 3D 场景实例
const arena = document.querySelector('#webgl')
// 通过 ref 访问 globeControllerRef 可以获取：
//   - getSpaceshipManager()
//   - getEarth()
//   - getCamera()
//   - getControls()
```

**3. 性能面板**

设置面板中的 "Performance Monitor" 开关可开启实时性能面板。

**4. React DevTools**

使用 React DevTools 查看组件状态：
- `InteractiveArena`：3D 场景状态
- `ScoreboardPage`：数据获取状态

### 添加新的攻击特效

1. 在 `SpaceshipManager.js` 中添加创建方法：

```javascript
createNewAttackType(attack) {
    // 创建几何体和材质
    const mesh = new THREE.Mesh(geometry, material)
    attack.objects.push(mesh)
    this.add(mesh)
}
```

2. 添加更新方法：

```javascript
updateNewAttackType(attack, delta) {
    // 更新动画
    // 检查完成条件
}
```

3. 在 `createAttack()` 中增加 case：

```javascript
case 5: // 新攻击类型
    this.createNewAttackType(attack)
    break
```

4. 在 `updateAttacks()` 和 `completeAttack()` 中增加对应处理。

### 添加新的国家映射

1. 在 `Earth-github.js` 的 `selectedCountries` 数组中添加国家名
2. 确保该国家在 `globe.json` 中为 Polygon 类型且无内环
3. 在 `getCountry3DPosition()` 中添加经纬度坐标
4. 在 `category-mapping-service.ts` 中添加映射

### 脚本说明

```bash
npm run a11y:title            # 比赛标题 WCAG 可访问性检查
npm run screenshots:glow      # 标题发光效果截图生成
npm run verify:title-center   # 标题居中验证
npm run verify:title-browsers # 标题跨浏览器验证
npm run metrics:glow          # 发光效果可见性指标
```

---

## 9. 常见问题

### Q: 3D 场景不显示？

1. 检查浏览器 WebGL 支持：访问 `chrome://gpu`
2. 检查控制台错误
3. 确认 `/public/texture/` 下纹理文件存在
4. 确认 GZCTF API 可访问

### Q: 飞船重叠？

排名固定位置系统应完全避免重叠。如仍出现：
- 检查 `updateTeams()` 中的排名排序
- 检查 `getRankPositionConfig()` 角度计算

### Q: 攻击穿过地球？

弧形路径算法应自动避开。检查：
- `calculateAttackPath()` 的条件判断
- 飞船是否在轨道外（`startDist > earthRadius * 1.2`）

### Q: 性能问题？

1. 减少 `maxShips`（移动端 15 / 桌面端 20）
2. 关闭 Bloom 后处理
3. 降低 `renderQuality`
4. 关闭 `enableComplexEffects`
5. 减少粒子数量

### Q: 构建部署失败？

- 项目配置了 `ignoreBuildErrors: true`（ESLint + TypeScript），检查是否是其他问题
- 确认 Node.js 版本 >= 18
- 确认依赖完整安装

---

## 附录

### A. 依赖版本（核心）

| 包 | 版本 | 说明 |
|----|------|------|
| next | 14.2.16 | React 框架 |
| three | 0.169.0 | 3D 渲染引擎 |
| gsap | 3.12.5 | 动画库 |
| postprocessing | 6.36.4 | 后处理特效 |
| earcut | 2.2.4 | 多边形三角剖分 |
| tailwindcss | 3.4.17 | CSS 框架 |

### B. Three.js 对象生命周期

```
创建: new Mesh(geometry, material) → scene.add(mesh)
使用: 在 update() 中修改 position/rotation/scale/material
清理: scene.remove(mesh) → geometry.dispose() → material.dispose()
```

### C. 颜色参考

| Category | Hex | 色值 |
|----------|-----|------|
| Web | `#ff6b6b` | 暖红色 |
| Crypto | `#4ecdc4` | 青色 |
| Pwn | `#45b7d1` | 蓝色 |
| Reverse | `#96ceb4` | 绿色 |
| Blockchain | `#feca57` | 金色 |
| Forensics | `#ff9ff3` | 粉色 |
| Hardware | `#54a0ff` | 亮蓝 |
| Mobile | `#5f27cd` | 紫色 |
| PPC | `#00d2d3` | 蓝绿 |
| AI | `#ff6348` | 橙红 |
| Pentest | `#2ed573` | 亮绿 |
| OSINT | `#ffa502` | 橙色 |
| Misc | `#ff7675` | 浅红 |
