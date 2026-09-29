// @ts-nocheck
import * as THREE from 'three';

// ---- 飞船尺寸与朝向配置 ----
// 飞船目标尺寸（世界单位）= SHIP_SIZE_FACTOR × finalSize
const SHIP_SIZE_FACTOR = 24;
// 机头是否始终朝向地球球心（true=盯着地球飞；false=朝轨道切线方向）
const FACE_EARTH = true;
// 朝向计算复用临时对象（避免每帧 new）
const _lookM = new THREE.Matrix4();
const _origin = new THREE.Vector3(0, 0, 0);
const _upAxis = new THREE.Vector3(0, 1, 0);

// ---- 飞船模型 ----
// 模型已由 scripts/assets/build-ship-binary.mjs 预处理为精简二进制（约 0.8MB）。
// 浏览器端只做零拷贝读取，不再现场解析 11MB FBX —— 后者实测需 20~30 秒且低配机器会失败
// （表现就是"只有光晕、看不到飞船"）。
// 换模型：把新 FBX 放到 public/models/ 后运行
//   node scripts/assets/build-ship-binary.mjs public/models/<新模型>.fbx public/models/xwing.ship [聚类网格]
const MODEL_BIN_URL = '/models/xwing.ship';

// 共享原型：全局只加载一次，所有飞船复用同一份几何体
interface ShipPrototype {
    geometry: THREE.BufferGeometry
    longest: number
    center: THREE.Vector3
}
let prototypePromise: Promise<ShipPrototype> | null = null
let sharedPrototypeGeometry: THREE.BufferGeometry | null = null
let prototypeGeneration = 0

function buildSpaceshipPrototype(): Promise<ShipPrototype> {
    if (!prototypePromise) {
        const generation = prototypeGeneration
        prototypePromise = (async () => {
            const t0 = performance.now()
            const res = await fetch(MODEL_BIN_URL)
            if (!res.ok) throw new Error(`模型资源加载失败: HTTP ${res.status}`)
            const ab = await res.arrayBuffer()
            const dv = new DataView(ab)
            const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
            if (magic !== 'SHIP') throw new Error('模型资源格式不正确（应由 build-ship-binary.mjs 生成）')

            const count = dv.getUint32(8, true)
            const indexCount = dv.getUint32(12, true)
            const minX = dv.getFloat32(16, true), minY = dv.getFloat32(20, true), minZ = dv.getFloat32(24, true)
            const maxX = dv.getFloat32(28, true), maxY = dv.getFloat32(32, true), maxZ = dv.getFloat32(36, true)

            let off = 40
            const pos = new Float32Array(ab, off, count * 3); off += count * 12
            const nrm = new Int8Array(ab, off, count * 3); off += count * 3
            const col = new Uint8Array(ab, off, count * 3); off += count * 3
            const acc = new Uint8Array(ab, off, count); off += count
            off += (4 - (off % 4)) % 4   // 索引段 4 字节对齐
            const idx = new Uint32Array(ab, off, indexCount)

            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
            geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true))
            geometry.setAttribute('color', new THREE.BufferAttribute(col, 3, true))
            // 注意：aAccent 是 0/1 的整数值，必须 normalized=false ——
            // 若归一化成 1/255，队伍色会几乎不可见（飞船看起来发白）
            geometry.setAttribute('aAccent', new THREE.BufferAttribute(acc, 1, false))
            geometry.setIndex(new THREE.BufferAttribute(idx, 1))

            // 管理器可能在网络请求完成前已销毁，避免把迟到的模型留在 GPU 中。
            if (generation !== prototypeGeneration) {
                geometry.dispose()
                throw new Error('飞船模型加载已取消')
            }
            sharedPrototypeGeometry = geometry

            const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
            const longest = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1
            console.log(`[Spaceship] 精简模型就绪：${count} 顶点 / ${indexCount / 3} 三角形，用时 ${(performance.now() - t0).toFixed(0)}ms`)
            return { geometry, longest, center }
        })().catch((error) => {
            // 失败后允许后续飞船重试；不要覆盖新一代的加载 Promise。
            if (generation === prototypeGeneration) prototypePromise = null
            throw error
        })
    }
    return prototypePromise
}

export function disposeSpaceshipPrototype(): void {
    prototypeGeneration += 1
    sharedPrototypeGeometry?.dispose()
    sharedPrototypeGeometry = null
    prototypePromise = null
}

export default class Spaceship extends THREE.Object3D {
    /**
     * 3D飞船模型
     * @param {{
     *   teamId?: number,
     *   teamName?: string,
     *   rank?: number,
     *   score?: number,
     *   colorHue?: number,
     *   size?: number,
     *   orbitRadius?: number,
     *   orbitSpeed?: number,
     *   orbitHeight?: number,
     *   orbitOffset?: number
     * }} config 
     */
    constructor(config = {}) {
        super();
        this.isDisposed = false;
        
        const {
            teamId = 0,
            teamName = 'Unknown',
            rank = 1,
            score = 0,
            colorHue = 0,
            size = 1,
            orbitRadius = 200,
            orbitSpeed = -0.05, // 修复：负值=逆时针（与地球同向），会乘以delta
            orbitHeight = 0,
            orbitOffset = 0
        } = config;

        this.name = `Spaceship_${teamId}`;
        this.teamId = teamId;
        this.teamName = teamName;
        this.rank = rank;
        this.score = score;
        this.colorHue = colorHue;
        this.size = size;
        this.orbitRadius = orbitRadius;
        this.orbitSpeed = orbitSpeed;
        this.orbitHeight = orbitHeight;
        this.orbitOffset = orbitOffset;

        // 轨道参数
        this.angle = 0; // 修复：从0开始累加，避免重叠
        this.isOvertaking = false;
        this.overtakeProgress = 0;
        this.targetRank = rank;

        // 排名脉冲特效
        this.isPulsing = false
        this.pulsePhase = 0
        this.pulseType = ''   // 'up' | 'down'
        this.pulseDuration = 0
        
        // 轨道过渡参数
        this.targetOrbitRadius = orbitRadius;
        this.targetOrbitHeight = orbitHeight;
        this.targetOrbitOffset = orbitOffset; // 新增：目标角度偏移
        this.orbitTransitionSpeed = 0.05; // 轨道变化速度，提高响应速度
        
        // 动画参数
        this.pulsation = Math.random() * Math.PI * 2;
        this.enginePulse = Math.random() * Math.PI * 2;
        this.verticalPhase = Math.random() * Math.PI * 2;
        
        // 平滑位置
        this.smoothX = 0;
        this.smoothY = 0;
        this.smoothZ = 0;
        
        // 尾迹系统
        this.trailPositions = [];
        this.trailGeometry = null;
        this.trailMaterial = null;
        this.trailMesh = null;
        
        // 引擎粒子系统
        this.engineParticles = null;
        this.particleSystem = null;
        
        // 状态
        this.isActive = false;
        this.modelLoaded = false;
        this.hasLaunched = false; // 是否已经从地球飞出
        this.launchProgress = 0; // 发射进度
        this.launchDuration = 3; // 发射动画持续时间（秒）
        
        // 异步加载FBX模型
        this.loadFBXModel();
        this.createTrail();
        this.createEngineEffects();
        this.createRankIndicator();
        this.createTeamLabel();
    }

    /**
     * 异步加载FBX模型
     */
    /**
     * 占位机体：共享 3D 模型要解析 118 万顶点（实测 20~30 秒），
     * 在此之前先显示一个简易 X 形战机，避免"只有光晕、看不到飞船"。
     * 模型就绪后会被真实 X-wing 替换掉。
     */
    createPlaceholderMesh(finalSize) {
        const L = finalSize * SHIP_SIZE_FACTOR;
        const g = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(this.colorHue / 360, 0.55, 0.55),
            specular: new THREE.Color('#cfd8e3'),
            shininess: 40,
            side: THREE.DoubleSide,
        });
        const body = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, L * 0.14, L * 0.95), mat);
        g.add(body);
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const wing = new THREE.Mesh(new THREE.BoxGeometry(L * 0.42, L * 0.04, L * 0.2), mat);
            wing.position.set(sx * L * 0.24, sy * L * 0.1, L * 0.04);
            wing.rotation.z = sx * sy * 0.1;
            g.add(wing);
        }
        return g;
    }

    async loadFBXModel() {
        // 根据排名调整大小（缩小差距）
        const rankMultiplier = this.rank <= 3 ? (this.rank === 1 ? 1.3 : this.rank === 2 ? 1.2 : 1.1) : 1.0;
        const finalSize = this.size * rankMultiplier;

        // 外层 wrapper 立即建立：承载每帧朝向动画
        const wrapper = new THREE.Group();
        this.spaceshipMesh = wrapper;
        this.add(wrapper);

        // ① 先挂占位机体 + 光晕（这样飞船一出现就是"看得见的船"）
        const placeholder = this.createPlaceholderMesh(finalSize);
        wrapper.add(placeholder);
        this.createGlow(finalSize);

        try {
            // 全局共享模型：只加载/解析/合并一次，所有飞船复用同一份几何体
            const proto = await buildSpaceshipPrototype();
            if (this.isDisposed) return;

            // 尺寸归一化：按包围盒最长边缩放到目标世界尺寸（换任何模型视觉大小一致）
            const targetLongest = finalSize * SHIP_SIZE_FACTOR;
            const s = targetLongest / proto.longest;

            // 涂装 + 队伍色：
            //   顶点色 = 机身白/深色细节（20 艘共享，固定）
            //   aAccent 蒙版 = 条纹区域 -> 由 uAccent 注入"每队颜色"
            //   uHullShift = 机身极轻微的色调/明度差异（每队不同，便于一眼分辨）
            const hue = this.colorHue / 360;
            const v = ((this.colorHue * 7919) % 100) / 100; // 每队稳定的伪随机 0~1
            const accentColor = new THREE.Color().setHSL(hue, 0.72, 0.40 + 0.12 * v);
            const hullShift = new THREE.Color().setHSL(hue, 0.10 + 0.08 * v, 0.98 - 0.06 * v);
            const material = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                vertexColors: true, // 使用烘焙涂装
                emissive: new THREE.Color().setHSL(hue, 0.45, 0.035),
                specular: new THREE.Color('#cfd8e3'), // 金属高光
                shininess: 55,
                side: THREE.DoubleSide, // 机翼等薄面片：避免单面剔除导致模型"缺面"
            });
            material.onBeforeCompile = (shader) => {
                shader.uniforms.uAccent = { value: accentColor };
                shader.uniforms.uHullShift = { value: hullShift };
                shader.vertexShader = shader.vertexShader
                    .replace('#include <common>', '#include <common>\nattribute float aAccent;\nvarying float vAccent;')
                    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAccent = aAccent;');
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <common>', '#include <common>\nuniform vec3 uAccent;\nuniform vec3 uHullShift;\nvarying float vAccent;')
                    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb * uHullShift, uAccent, vAccent);');
            };
            // 所有飞船共用同一份着色器程序（仅 uniform 不同）
            material.customProgramCacheKey = () => 'xwing-livery-v1';

            const hull = new THREE.Mesh(proto.geometry, material);
            hull.scale.setScalar(s);
            hull.position.copy(proto.center).multiplyScalar(-s); // 居中，避免偏心绕轨
            hull.castShadow = true;
            hull.receiveShadow = false;

            // ② 模型就绪：换上真机体，移除占位
            wrapper.add(hull);
            wrapper.remove(placeholder);
            placeholder.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() });

            this.modelLoaded = true;
            console.log(`Spaceship model loaded for team ${this.teamName}`);

        } catch (error) {
            if (this.isDisposed) return;
            console.error('Failed to load FBX model:', error);
            // 保留占位机体（旧实现"备用模型已删除"会导致这条路径下只剩光晕）
            console.warn(`Spaceship ${this.teamName}: 模型加载失败，继续使用占位机体`);
            this.modelLoaded = true;
        }
    }

    /**
     * 创建备用飞船（当FBX加载失败时）- 已删除，不再使用备用模型
     */
    createFallbackSpaceship() {
        // 备用模型已删除，直接创建光晕和标签
        const rankMultiplier = this.rank <= 3 ? (this.rank === 1 ? 1.3 : this.rank === 2 ? 1.2 : 1.1) : 1.0;
        const finalSize = this.size * rankMultiplier;
        
        this.createGlow(finalSize);
        this.modelLoaded = true;
        console.log(`Spaceship ${this.teamName} using glow effect only (no fallback model)`);
    }


    /**
     * 创建飞船光晕
     */
    createGlow(size) {
        const glowGeometry = new THREE.SphereGeometry(size * 1.8, 16, 16); // 从2.0减小到1.8，适配飞船大小
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(this.colorHue / 360, 0.8, 0.5),
            transparent: true,
            opacity: 0.22, // 从0.25减小到0.22
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });

        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glowMesh.renderOrder = -1;
        this.add(this.glowMesh);
    }

    /**
     * 创建尾迹系统
     */
    createTrail() {
        const trailLength = 20;
        const positions = new Float32Array(trailLength * 3);
        const colors = new Float32Array(trailLength * 3);
        
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        this.trailMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            linewidth: 3
        });
        
        this.trailMesh = new THREE.Line(this.trailGeometry, this.trailMaterial);
        this.trailMesh.renderOrder = 1;
        this.add(this.trailMesh);
    }

    /**
     * 创建引擎粒子效果
     */
    createEngineEffects() {
        const particleCount = 50;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 2;
            positions[i3 + 1] = -this.size * 0.8 + Math.random() * 0.5;
            positions[i3 + 2] = (Math.random() - 0.5) * 2;
            
            const color = new THREE.Color().setHSL(this.colorHue / 360, 1, 0.7);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            sizes[i] = Math.random() * 0.5 + 0.2;
        }
        
        this.particleGeometry = new THREE.BufferGeometry();
        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        this.particleMaterial = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.particleSystem.renderOrder = 2;
        this.add(this.particleSystem);
    }

    /**
     * 创建排名指示器
     */
    createRankIndicator() {
        if (this.rank <= 3) {
            // 创建排名光环（适度尺寸）
            const ringGeometry = new THREE.RingGeometry(this.size * 1.3, this.size * 1.5, 16); // 从1.5/1.8减小到1.3/1.5，适配飞船
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: this.rank === 1 ? 0xffd700 : this.rank === 2 ? 0xc0c0c0 : 0xcd7f32,
                transparent: true,
                opacity: 0.65, // 从0.7减小到0.65
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            
            this.rankRing = new THREE.Mesh(ringGeometry, ringMaterial);
            this.rankRing.position.y = this.size * 0.6; // 从0.7减小到0.6
            this.rankRing.lookAt(0, 0, 0);
            this.add(this.rankRing);
            
            // 创建排名数字
            this.createRankNumber();
        }
    }

    /**
     * 创建排名数字
     */
    createRankNumber() {
        const rankStr = this.rank.toString();
        const rankColor = this.rank === 1 ? '#ffd700' : this.rank === 2 ? '#c0c0c0' : '#cd7f32';

        // 复用已有 Canvas，避免每帧重建
        if (this.rankCanvas && this.rankCtx) {
            const ctx = this.rankCtx;
            ctx.clearRect(0, 0, 128, 128);
            ctx.fillStyle = rankColor;
            ctx.font = 'bold 96px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(rankStr, 64, 64);
            if (this.rankTexture) this.rankTexture.needsUpdate = true;
            return;
        }

        // 首次创建 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');

        context.fillStyle = rankColor;
        context.font = 'bold 96px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(rankStr, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        this.rankCanvas = canvas;
        this.rankCtx = context;
        this.rankTexture = texture;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.95
        });

        this.rankSprite = new THREE.Sprite(material);
        this.rankSprite.scale.set(this.size * 1.0, this.size * 1.0, 1);
        // 名次徽标挂到船体下缘（船体放大后，旧偏移会陷进机身里看不见）
        const shipLength = this.size *
            (this.rank <= 3 ? (this.rank === 1 ? 1.3 : this.rank === 2 ? 1.2 : 1.1) : 1.0) * SHIP_SIZE_FACTOR;
        this.rankSprite.position.y = -shipLength * 0.5;
        this.add(this.rankSprite);
    }
    
    /**
     * 创建团队标签 - 精确计算版本，完美比例
     */
    createTeamLabel() {
        const rankMultiplier = this.rank <= 3 
            ? (this.rank === 1 ? 1.8 : this.rank === 2 ? 1.7 : 1.6) 
            : 1.5;
        const labelScale = rankMultiplier * 11.0; // 10.0 * 1.1 = 11.0，整体增大10%
        // 标签要抬到船体上方：船体尺寸随 SHIP_SIZE_FACTOR 放大，旧偏移会把标签压进船身
        const shipLength = this.size *
            (this.rank <= 3 ? (this.rank === 1 ? 1.3 : this.rank === 2 ? 1.2 : 1.1) : 1.0) * SHIP_SIZE_FACTOR;
        const labelHeight = this.size * rankMultiplier * 7.5 + shipLength * 0.62;
        
        // 1. 先测量文字实际宽度
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        const teamNameFontSize = 280;  // 队名字体：更大更醒目
        const rankFontSize = 230;      // 排名字体
        const scoreFontSize = 200;     // 分数字体
        
        tempCtx.font = `bold ${teamNameFontSize}px Arial`;
        const teamNameWidth = tempCtx.measureText(this.teamName).width;
        
        tempCtx.font = `bold ${rankFontSize}px Arial`;
        const rankWidth = tempCtx.measureText(`#${this.rank}`).width;
        
        tempCtx.font = `bold ${scoreFontSize}px Arial`;
        const scoreWidth = tempCtx.measureText(`Score: ${this.score}`).width;
        
        // 2. 根据最宽的文字计算canvas宽度
        const maxTextWidth = Math.max(teamNameWidth, rankWidth, scoreWidth);
        const padding = 120;
        const canvasWidth = Math.ceil(maxTextWidth + padding);
        
        // 3. 精确计算高度（根据实际字体大小）
        const teamNameHeight = teamNameFontSize * 1.2;
        const rankHeight = rankFontSize * 1.2;
        const scoreHeight = scoreFontSize * 1.2;
        const lineSpacing = 50;
        const topPadding = 60;
        const bottomPadding = 60;
        
        const canvasHeight = topPadding + teamNameHeight + lineSpacing + 
                            rankHeight + lineSpacing + scoreHeight + bottomPadding;
        
        // 4. 创建精确大小的canvas
        const nameCanvas = document.createElement('canvas');
        nameCanvas.width = canvasWidth;
        nameCanvas.height = canvasHeight;
        const ctx = nameCanvas.getContext('2d');
        
        // 5. 绘制背景和边框
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5 * rankMultiplier;
        ctx.strokeRect(0, 0, canvasWidth, canvasHeight);
        
        // 6. 文字阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.shadowBlur = 10;
        
        // 7. 计算精确的Y坐标
        const teamNameY = topPadding + teamNameHeight / 2;
        const rankY = topPadding + teamNameHeight + lineSpacing + rankHeight / 2;
        const scoreY = topPadding + teamNameHeight + lineSpacing + 
                       rankHeight + lineSpacing + scoreHeight / 2;
        
        // 8. 绘制文字
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${teamNameFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.teamName, canvasWidth / 2, teamNameY);
        
        const rankColor = this.rank === 1 ? '#ffd700' 
            : this.rank === 2 ? '#c0c0c0' 
            : this.rank === 3 ? '#cd7f32' 
            : '#ffffff';
        ctx.fillStyle = rankColor;
        ctx.font = `bold ${rankFontSize}px Arial`;
        ctx.fillText(`#${this.rank}`, canvasWidth / 2, rankY);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = `bold ${scoreFontSize}px Arial`;
        ctx.fillText(`Score: ${this.score}`, canvasWidth / 2, scoreY);
        
        // 9. 创建/复用 Sprite 和纹理（保存引用以便原地更新，避免每帧重建）
        if (this.nameTexture) this.nameTexture.dispose();
        const nameTexture = new THREE.CanvasTexture(nameCanvas);
        this.labelCanvas = nameCanvas;
        this.labelCtx = ctx;
        this.labelCanvasWidth = canvasWidth;
        this.labelCanvasHeight = canvasHeight;
        this.labelScale = labelScale;
        this.labelHeight = labelHeight;
        this.nameTexture = nameTexture;

        if (this.nameSprite) {
            // 复用已有 Sprite，只替换纹理
            this.nameSprite.material.map = nameTexture;
            this.nameSprite.material.needsUpdate = true;
            const aspect = canvasWidth / canvasHeight;
            this.nameSprite.scale.set(
                this.size * labelScale * aspect * 0.8,
                this.size * labelScale * 0.8,
                1
            );
            this.nameSprite.position.y = labelHeight;
        } else {
            const nameMaterial = new THREE.SpriteMaterial({
                map: nameTexture,
                transparent: true,
                opacity: 0.95
            });
            const aspect = canvasWidth / canvasHeight;
            this.nameSprite = new THREE.Sprite(nameMaterial);
            this.nameSprite.scale.set(
                this.size * labelScale * aspect * 0.8,
                this.size * labelScale * 0.8,
                1
            );
            this.nameSprite.position.y = labelHeight;
            this.add(this.nameSprite);
        }
    }

    /**
     * 更新飞船位置
     */
    updatePosition(delta) {
        this.enginePulse += delta * 4;
        this.verticalPhase += delta * 0.5;
        this.pulsation += delta * 2;

        // 处理飞船发射动画
        if (!this.hasLaunched) {
            this.updateLaunchAnimation(delta);
            return;
        }

        // 平滑过渡到目标轨道参数
        this.updateOrbitTransition(delta);

        let targetX, targetY, targetZ;

        if (!this.isOvertaking) {
            // 修复：使用delta确保帧率无关的旋转，与地球同步
            this.angle += this.orbitSpeed * delta;
            // 修复：使用orbitOffset作为基准角度，确保飞船位置正确
            const currentAngle = this.orbitOffset + this.angle;
            targetX = Math.cos(currentAngle) * this.orbitRadius;
            targetZ = Math.sin(currentAngle) * this.orbitRadius;
            targetY = this.orbitHeight + Math.sin(this.verticalPhase) * 20;
            
            // 设置飞船朝向轨道飞行方向
            this.updateSpaceshipOrientation(targetX, targetZ);
        } else {
            // 超车动画 - 修复：使用固定时间而不是进度依赖
            this.overtakeProgress += delta * (this.overtakeSpeed || 0.03);
            
            if (this.overtakeProgress < 1) {
                const progress = this.overtakeProgress;
                
                // 修复：使用更自然的超车路径
                const arcHeight = this.overtakeArcHeight * Math.sin(progress * Math.PI);
                const laneShift = Math.sin(progress * Math.PI) * this.overtakeLaneShift;
                
                // 计算基础轨道位置
                const baseAngle = this.orbitOffset + this.angle + progress * 0.1; // 轻微前进
                const baseX = Math.cos(baseAngle) * this.orbitRadius;
                const baseZ = Math.sin(baseAngle) * this.orbitRadius;

                // 应用超车偏移
                targetX = baseX + Math.cos(baseAngle + Math.PI / 2) * laneShift;
                targetZ = baseZ + Math.sin(baseAngle + Math.PI / 2) * laneShift;
                targetY = this.orbitHeight + arcHeight + Math.sin(this.verticalPhase) * 8;

                // 修复：不要直接修改this.angle，保持角度连续性
                // this.angle = baseAngle;
                
                // 超车时的特殊效果
                this.updateOvertakeEffects(progress);
            } else {
                // 超车完成
                this.isOvertaking = false;
                this.overtakeProgress = 0;
                this.rank = this.targetRank;
                
                // 立即更新团队标签
                this.updateTeamLabel();
                
                console.log(`Spaceship ${this.teamName} completed overtake to rank ${this.rank}`);
            }
        }

        // 平滑位置插值 - 优化流畅度，减少抖动（使用基于delta的平滑，防止帧率波动导致的抖动）
        const smoothAlpha = 1 - Math.exp(-15.0 * delta); // frame-rate independent interpolation
        this.smoothX += (targetX - this.smoothX) * smoothAlpha;
        this.smoothY += (targetY - this.smoothY) * smoothAlpha;
        this.smoothZ += (targetZ - this.smoothZ) * smoothAlpha;

        this.position.set(this.smoothX, this.smoothY, this.smoothZ);

        // 更新尾迹
        this.updateTrail();

        // 更新引擎粒子
        this.updateEngineParticles(delta);

        // 更新动画效果
        this.updateAnimations(delta);
        
        // 更新标签朝向相机
        this.updateLabelOrientation();
    }
    
    /**
     * 更新发射动画
     */
    updateLaunchAnimation(delta: any) {
        this.launchProgress += delta / this.launchDuration

        // 发射期间也按轨道速度旋转，保持与轨道代码的 angle 完全一致
        this.angle += this.orbitSpeed * delta

        if (this.launchProgress >= 1) {
            this.launchProgress = 1
            this.hasLaunched = true
        }

        // 从地球表面直线发射到轨道（半径和高度渐变，角度不变）
        const earthRadius = 100
        const surfaceRadius = earthRadius * 1.02
        const launchRadius = surfaceRadius + (this.orbitRadius - surfaceRadius) * this.launchProgress
        const launchHeight = this.orbitHeight * this.launchProgress

        // 角度使用与轨道完全相同的公式，确保无跳变
        const launchAngle = this.orbitOffset + this.angle

        const targetX = Math.cos(launchAngle) * launchRadius
        const targetZ = Math.sin(launchAngle) * launchRadius
        const targetY = launchHeight

        this.updateSpaceshipOrientation(targetX, targetZ)

        const smoothAlpha = 1 - Math.exp(-15.0 * delta)
        this.smoothX += (targetX - this.smoothX) * smoothAlpha
        this.smoothY += (targetY - this.smoothY) * smoothAlpha;
        this.smoothZ += (targetZ - this.smoothZ) * smoothAlpha;
        
        this.position.set(this.smoothX, this.smoothY, this.smoothZ);
        
        // 更新尾迹
        this.updateTrail();
        
        // 更新引擎粒子
        this.updateEngineParticles(delta);
        
        // 更新动画效果
        this.updateAnimations(delta);
        
        // 更新标签朝向相机
        this.updateLabelOrientation();
    }
    
    /**
     * 更新飞船朝向
     * FACE_EARTH = true  -> 机头始终指向地球球心（飞船"盯着"地球飞）
     * FACE_EARTH = false -> 旧行为：机头朝轨道切线方向（沿航向前进）
     */
    updateSpaceshipOrientation() {
        if (!this.spaceshipMesh) return;

        if (FACE_EARTH) {
            // 模型机头在局部 -Z（机头 z=-819 / 机尾 z=+271）。
            // Matrix4.lookAt(eye, target, up) 使物体 +Z = normalize(eye - target)：
            // 取 eye=飞船位置、target=球心 ⇒ +Z 朝外 ⇒ -Z(机头) 正对地球。
            _lookM.lookAt(this.position, _origin, _upAxis);
            this.spaceshipMesh.quaternion.setFromRotationMatrix(_lookM);
            // 轻微摆动，保留生命感（幅度小，不影响"朝向地球"的观感）
            this.spaceshipMesh.rotateX(Math.sin(this.verticalPhase) * 0.06);
            this.spaceshipMesh.rotateZ(Math.cos(this.verticalPhase) * 0.05);
            return;
        }

        // ---- 旧行为：朝切线方向 ----
        const currentAngle = this.orbitOffset + this.angle;
        const tangentX = -Math.sin(currentAngle);
        const tangentZ = Math.cos(currentAngle);
        const angle = Math.atan2(tangentZ, tangentX);
        this.spaceshipMesh.rotation.y = angle;
        this.spaceshipMesh.rotation.x = Math.sin(this.verticalPhase) * 0.1;
        this.spaceshipMesh.rotation.z = Math.cos(this.verticalPhase) * 0.05;
    }
    
    /**
     * 更新标签朝向相机
     */
    updateLabelOrientation() {
        // 这里需要相机引用，暂时使用简单的朝向
        if (this.nameSprite) {
            this.nameSprite.lookAt(0, 0, 0);
        }
        if (this.rankSprite) {
            this.rankSprite.lookAt(0, 0, 0);
        }
    }
    
    /**
     * 更新超车特效 - 修复旋转问题
     */
    updateOvertakeEffects(progress) {
        // 超车时的飞船缩放效果 - 减小缩放幅度
        const overtakeScale = 1 + Math.sin(progress * Math.PI) * 0.15; // 从0.3减少到0.15
        this.scale.setScalar(overtakeScale);
        
        // 超车时同样保持机头朝向地球，只用轻微滚转表现机动
        if (this.spaceshipMesh) {
            this.updateSpaceshipOrientation();
            this.spaceshipMesh.rotateZ(Math.sin(progress * Math.PI) * 0.35);
        }
        
        // 超车时的引擎粒子增强
        if (this.particleSystem) {
            const engineBoost = 1 + Math.sin(progress * Math.PI) * 1.5; // 从2减少到1.5
            this.particleSystem.material.opacity = Math.min(1, engineBoost);
        }
        
        // 超车时的光晕增强
        if (this.glowMesh) {
            const glowBoost = 0.2 + Math.sin(progress * Math.PI) * 0.15; // 从0.3减少到0.15
            this.glowMesh.material.opacity = glowBoost;
        }
        
        // 超车时的尾迹增强
        if (this.trailMaterial) {
            const trailBoost = 0.8 + Math.sin(progress * Math.PI) * 0.2; // 从0.4减少到0.2
            this.trailMaterial.opacity = trailBoost;
        }
    }
    
    /**
     * 更新轨道过渡 - 支持角度、半径、高度平滑过渡
     */
    updateOrbitTransition(delta) {
        // 修复：使用帧率无关的过渡速度，降低速度减少抖动
        const transitionSpeed = this.orbitTransitionSpeed * delta * 30; // 从60降低到30，减少过渡速度
        let hasReachedTarget = true; // 检查是否已到达目标位置
        
        // 平滑过渡轨道半径 - 使用更平滑的插值
        const radiusDiff = this.targetOrbitRadius - this.orbitRadius;
        if (Math.abs(radiusDiff) > 0.1) {
            this.orbitRadius += radiusDiff * transitionSpeed;
            hasReachedTarget = false;
        } else if (Math.abs(radiusDiff) > 0.01) {
            this.orbitRadius = this.targetOrbitRadius;
        }
        
        // 平滑过渡轨道高度 - 使用更平滑的插值
        const heightDiff = this.targetOrbitHeight - this.orbitHeight;
        if (Math.abs(heightDiff) > 0.1) {
            this.orbitHeight += heightDiff * transitionSpeed;
            hasReachedTarget = false;
        } else if (Math.abs(heightDiff) > 0.01) {
            this.orbitHeight = this.targetOrbitHeight;
        }
        
        // 平滑过渡轨道角度偏移（基于排名的固定位置系统）- 修复：更平滑的角度过渡
        if (this.targetOrbitOffset !== undefined) {
            const offsetDiff = this.targetOrbitOffset - this.orbitOffset;
            // 处理角度环绕（选择最短路径）
            const normalizedDiff = ((offsetDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
            
            if (Math.abs(normalizedDiff) > 0.01) {
                // 使用更平滑的角度插值
                this.orbitOffset += normalizedDiff * transitionSpeed;
                // 确保角度在 [0, 2π] 范围内
                this.orbitOffset = (this.orbitOffset + Math.PI * 2) % (Math.PI * 2);
                hasReachedTarget = false;
            } else {
                // 已经接近目标，直接设置
                this.orbitOffset = this.targetOrbitOffset;
            }
        }
        
        // 到达目标位置后，恢复默认过渡速度
        if (hasReachedTarget && this.orbitTransitionSpeed !== 0.03) { // 从0.05降低到0.03，更慢的过渡
            this.orbitTransitionSpeed = 0.03;
        }
    }

    /**
     * 更新尾迹
     */
    updateTrail() {
        if (!this.trailGeometry) return;

        const positions = this.trailGeometry.attributes.position.array;
        const colors = this.trailGeometry.attributes.color.array;
        
        // 移动尾迹位置
        for (let i = positions.length - 1; i >= 3; i--) {
            positions[i] = positions[i - 3];
        }
        
        // 添加新位置
        positions[0] = this.position.x;
        positions[1] = this.position.y;
        positions[2] = this.position.z;
        
        // 更新颜色渐变
        for (let i = 0; i < colors.length; i += 3) {
            const alpha = 1 - (i / 3) / (colors.length / 3);
            const color = new THREE.Color().setHSL(this.colorHue / 360, 0.8, 0.6);
            colors[i] = color.r * alpha;
            colors[i + 1] = color.g * alpha;
            colors[i + 2] = color.b * alpha;
        }
        
        this.trailGeometry.attributes.position.needsUpdate = true;
        this.trailGeometry.attributes.color.needsUpdate = true;
    }

    /**
     * 更新引擎粒子
     */
    updateEngineParticles(delta) {
        if (!this.particleGeometry) return;

        const positions = this.particleGeometry.attributes.position.array;
        const colors = this.particleGeometry.attributes.color.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            // 粒子向后移动
            positions[i + 1] -= delta * 50;
            
            // 如果粒子超出范围，重新生成
            if (positions[i + 1] < -this.size * 1.5) {
                positions[i] = (Math.random() - 0.5) * 2;
                positions[i + 1] = -this.size * 0.8;
                positions[i + 2] = (Math.random() - 0.5) * 2;
                
                const color = new THREE.Color().setHSL(this.colorHue / 360, 1, 0.7);
                colors[i] = color.r;
                colors[i + 1] = color.g;
                colors[i + 2] = color.b;
            }
        }
        
        this.particleGeometry.attributes.position.needsUpdate = true;
        this.particleGeometry.attributes.color.needsUpdate = true;
    }

    /**
     * 更新动画效果
     */
    updateAnimations(delta: any) {
        // === 正常动画（始终运行，脉冲期间也不例外）===

        // 飞船呼吸脉冲
        const pulseScale = 1 + Math.sin(this.pulsation) * 0.1;
        this.scale.setScalar(pulseScale);

        // 引擎脉冲
        if (this.particleSystem) {
            const enginePulse = 0.5 + Math.sin(this.enginePulse) * 0.5;
            this.particleSystem.material.opacity = enginePulse;
        }

        // 光晕基础呼吸（rank 脉冲会在此基础上叠加）
        let glowBaseOpacity = 0.22; // 默认值，createGlow 的初始 opacity
        if (this.glowMesh) {
            glowBaseOpacity = 0.2 + Math.sin(this.pulsation * 0.5) * 0.1;
            this.glowMesh.material.opacity = glowBaseOpacity;
        }

        // 排名光环旋转
        if (this.rankRing) {
            this.rankRing.rotation.z += delta * 2;
        }

        // === 排名变化脉冲特效（叠加在正常动画之上，不阻断正常动画）===
        if (this.isPulsing) {
            this.pulsePhase += delta;
            const t = this.pulsePhase / this.pulseDuration;
            if (t >= 1) {
                // 脉冲结束：清除状态。正常动画值已在上方设置，无需额外 reset
                this.isPulsing = false;
            } else {
                const flash = Math.sin(t * Math.PI);
                if (this.pulseType === 'up') {
                    // 上升脉冲：光晕 1→2.5x 扩张 + 高亮叠加
                    this.glowMesh.scale.setScalar(1 + flash * 1.5);
                    this.glowMesh.material.opacity = glowBaseOpacity + flash * 0.65;
                } else {
                    // 下降脉冲：光晕 1→0.5x 收缩 + 暗红叠加
                    this.glowMesh.scale.setScalar(1 - flash * 0.5);
                    this.glowMesh.material.opacity = Math.max(0.02, glowBaseOpacity - flash * 0.25);
                }
            }
        }
    }

    /**
     * 触发排名变化脉冲光晕
     * @param {'up'|'down'} type — 上升或下降
     */
    pulseGlow(type: string) {
        this.isPulsing = true
        this.pulsePhase = 0
        this.pulseType = type
        this.pulseDuration = type === 'up' ? 1.5 : 1.0
    }

    /**
     * 开始超车动画
     */
    startOvertaking(newRank) {
        this.isOvertaking = true;
        this.overtakeProgress = 0;
        this.targetRank = newRank;
        
        // 修复：调整动画参数，让动画更快更自然
        this.overtakeSpeed = 0.03; // 从0.008增加到0.03，加快动画速度
        this.overtakeArcHeight = 40; // 从150减少到40，减少向上飞行幅度
        this.overtakeLaneShift = 25; // 从80减少到25，减少横向移动
        
        console.log(`Spaceship ${this.teamName} starting overtake from rank ${this.rank} to ${newRank}`);
    }

    /**
     * 更新团队信息
     */
    updateTeamInfo(teamInfo) {
        const rankChanged = teamInfo.rank !== this.rank;
        const nameChanged = teamInfo.name !== this.teamName;
        const scoreChanged = teamInfo.score !== this.score;

        this.teamName = teamInfo.name;
        this.score = teamInfo.score;

        // 注：startOvertaking 已禁用 — 排名变化时的位置过渡由
        // SpaceshipManager 的 targetOrbitRadius/Height/Offset + updateOrbitTransition 驱动，
        // 超车动画（弧线路径）与平滑轨道过渡系统冲突
        this.rank = teamInfo.rank;

        // 颜色和标签由外部（SpaceshipManager.updateTeams / 自身 rank 变化检测）
        // 统一在排名变化路径中调用，避免每帧无条件重建 Canvas/纹理
        if (rankChanged) {
            this.updateSpaceshipColor();
        }
        if (rankChanged || nameChanged || scoreChanged) {
            this.updateTeamLabel();
        }
    }

    /**
     * 更新排名显示 - 新增方法
     */
    updateRankDisplay(newRank) {
        const oldRank = this.rank;
        this.rank = newRank;
        
        // 更新排名指示器
        if (this.rankIndicator) {
            this.remove(this.rankIndicator);
            this.createRankIndicator();
        }
        
        // 更新排名数字
        if (this.rankNumber) {
            this.remove(this.rankNumber);
            this.createRankNumber();
        }
        
        // 如果排名提升，触发超越动画
        if (newRank < oldRank) {
            this.startOvertaking(newRank);
        }
        
        console.log(`Spaceship ${this.teamName} rank updated from ${oldRank} to ${newRank}`);
    }
    
    /**
     * 更新团队标签 — 原地重绘 Canvas，不销毁重建纹理
     */
    updateTeamLabel() {
        // --- 团队名称标签：原地重绘 ---
        if (this.labelCanvas && this.labelCtx && this.nameTexture) {
            this._redrawLabelCanvas();
            this.nameTexture.needsUpdate = true;
        } else {
            this.createTeamLabel();
        }

        // --- 排名光环 / 排名数字 ---
        if (this.rank <= 3) {
            // 更新光环颜色（原地改材质，不重建几何体）
            if (this.rankRing) {
                const ringColor = this.rank === 1 ? 0xffd700 : this.rank === 2 ? 0xc0c0c0 : 0xcd7f32;
                this.rankRing.material.color.setHex(ringColor);
            } else {
                this.createRankIndicator();
            }
            // 更新排名数字（原地重绘 Canvas）
            if (this.rankCanvas && this.rankCtx && this.rankTexture) {
                const rankStr = this.rank.toString();
                const rankColor = this.rank === 1 ? '#ffd700' : this.rank === 2 ? '#c0c0c0' : '#cd7f32';
                const ctx = this.rankCtx;
                ctx.clearRect(0, 0, 128, 128);
                ctx.fillStyle = rankColor;
                ctx.font = 'bold 96px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(rankStr, 64, 64);
                this.rankTexture.needsUpdate = true;
            } else {
                this.createRankNumber();
            }
        } else {
            // 不在前三名：清理排名光环和数字
            if (this.rankRing) {
                this.remove(this.rankRing);
                if (this.rankRing.geometry) this.rankRing.geometry.dispose();
                if (this.rankRing.material) this.rankRing.material.dispose();
                this.rankRing = null;
            }
            if (this.rankSprite) {
                this.remove(this.rankSprite);
                if (this.rankTexture) this.rankTexture.dispose();
                if (this.rankSprite.material) this.rankSprite.material.dispose();
                this.rankSprite = null;
                this.rankCanvas = null;
                this.rankCtx = null;
                this.rankTexture = null;
            }
        }
    }

    /**
     * 原地重绘团队标签 Canvas（复用已有 Canvas/纹理，避免 GPU 上传）
     */
    _redrawLabelCanvas() {
        const ctx = this.labelCtx;
        const canvasWidth = this.labelCanvasWidth;
        const canvasHeight = this.labelCanvasHeight;

        const rankMultiplier = this.rank <= 3
            ? (this.rank === 1 ? 1.8 : this.rank === 2 ? 1.7 : 1.6)
            : 1.5;

        const teamNameFontSize = 280;
        const rankFontSize = 230;
        const scoreFontSize = 200;

        const teamNameHeight = teamNameFontSize * 1.2;
        const rankHeight = rankFontSize * 1.2;
        const scoreHeight = scoreFontSize * 1.2;
        const lineSpacing = 50;
        const topPadding = 60;

        // 清除并重绘背景
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5 * rankMultiplier;
        ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

        // 文字阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.shadowBlur = 10;

        const teamNameY = topPadding + teamNameHeight / 2;
        const rankY = topPadding + teamNameHeight + lineSpacing + rankHeight / 2;
        const scoreY = topPadding + teamNameHeight + lineSpacing + rankHeight + lineSpacing + scoreHeight / 2;

        // 队名
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${teamNameFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.teamName, canvasWidth / 2, teamNameY);

        // 排名
        const rankColor = this.rank === 1 ? '#ffd700'
            : this.rank === 2 ? '#c0c0c0'
            : this.rank === 3 ? '#cd7f32'
            : '#ffffff';
        ctx.fillStyle = rankColor;
        ctx.font = `bold ${rankFontSize}px Arial`;
        ctx.fillText(`#${this.rank}`, canvasWidth / 2, rankY);

        // 分数
        ctx.fillStyle = '#00ff00';
        ctx.font = `bold ${scoreFontSize}px Arial`;
        ctx.fillText(`Score: ${this.score}`, canvasWidth / 2, scoreY);
    }
    
    /**
     * 更新飞船颜色
     */
    updateSpaceshipColor() {
        if (!this.spaceshipMesh) return;
        
        this.spaceshipMesh.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.color) {
                            mat.color.setHSL(this.colorHue / 360, 0.8, 0.6);
                        }
                        if (mat.emissive) {
                            mat.emissive.setHSL(this.colorHue / 360, 0.3, 0.1);
                        }
                    });
                } else {
                    if (child.material.color) {
                        child.material.color.setHSL(this.colorHue / 360, 0.8, 0.6);
                    }
                    if (child.material.emissive) {
                        child.material.emissive.setHSL(this.colorHue / 360, 0.3, 0.1);
                    }
                }
            }
        });
    }

    /**
     * 设置激活状态
     */
    setActive(active) {
        this.isActive = active;
        
        if (this.spaceshipMesh) {
            this.spaceshipMesh.traverse((child) => {
                if (child.isMesh && child.material) {   
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.emissiveIntensity !== undefined) {
                                mat.emissiveIntensity = active ? 0.3 : 0.1;
                            }
                        });
                    } else {
                        if (child.material.emissiveIntensity !== undefined) {
                            child.material.emissiveIntensity = active ? 0.3 : 0.1;
                        }
                    }
                }
            });
        }
    }

    /**
     * 清理资源
     */
    dispose() {
        if (this.isDisposed) return;
        this.isDisposed = true;

        // 清理 Canvas 纹理引用
        if (this.nameTexture) this.nameTexture.dispose();
        if (this.rankTexture) this.rankTexture.dispose();
        if (this.rankRing) {
            if (this.rankRing.geometry) this.rankRing.geometry.dispose();
            if (this.rankRing.material) this.rankRing.material.dispose();
        }

        if (this.trailGeometry) this.trailGeometry.dispose();
        if (this.trailMaterial) this.trailMaterial.dispose();
        if (this.particleGeometry) this.particleGeometry.dispose();
        if (this.particleMaterial) this.particleMaterial.dispose();

        this.traverse(child => {
            // xwing 几何体由所有飞船共享，只能由 SpaceshipManager 统一释放。
            if (child.geometry && child.geometry !== sharedPrototypeGeometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}
