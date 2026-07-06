// @ts-nocheck
import * as THREE from 'three'
import gsap from 'gsap'

export default class AttackSystem {
    manager: any
    earthRadius: number
    attacks: any[]

    get earth() { return this.manager.earth }

    constructor(manager: any) {
        this.manager = manager
        this.earthRadius = manager.earthRadius
        this.attacks = manager.attacks
    }

    // ============ 统一攻击入口 ============

    createAttack(fromTeamId: number, targetCountry: string, challengeInfo: any) {
        const fromSpaceship = this.manager.spaceships.get(fromTeamId)
        if (!fromSpaceship) return

        let toPosition: THREE.Vector3 | null = null
        if (typeof targetCountry === 'string') {
            if (this.earth?.getCountryGeometryCenter) {
                const raw = this.earth.getCountryGeometryCenter(targetCountry)
                if (raw) toPosition = new THREE.Vector3(raw.x, raw.y, raw.z)
            }
            if (!toPosition && this.earth?.getCountry3DPosition) {
                const raw = this.earth.getCountry3DPosition(targetCountry)
                if (raw) toPosition = new THREE.Vector3(raw.x, raw.y, raw.z)
            }
        } else {
            toPosition = targetCountry
        }
        if (!toPosition) return

        const shipPos = new THREE.Vector3()
        fromSpaceship.getWorldPosition(shipPos)

        const attack = {
            id: `${fromTeamId}-${Date.now()}`,
            fromSpaceship,
            toPosition: toPosition.clone(),
            challengeInfo,
            progress: 0,
            startTime: Date.now(),
            targetCountry: typeof targetCountry === 'string' ? targetCountry : null,
            currentPosition: shipPos.clone(),
            direction: new THREE.Vector3().subVectors(toPosition, shipPos).normalize(),
            duration: 2000,   // 2 秒总时长
            pathPoints: [],
            earthRadius: this.earthRadius,
            beamGroup: null,    // THREE.Group：射线 + 射线粒子
            explosionGroup: null, // THREE.Group：爆炸粒子
        }

        this.calculateAttackPath(attack)

        // 创建射线
        this.createBeam(attack)

        // 创建目标爆炸（延迟到射线到达）
        attack._explosionDelay = gsap.delayedCall(1.2, () => {
            this.createExplosion(attack)
        })

        this.attacks.push(attack)
        fromSpaceship.setActive(true)
        return attack
    }

    // ============ 射线创建 ============

    createBeam(attack: any) {
        const group = new THREE.Group()
        attack.beamGroup = group

        // 主射线：从起点到终点
        const pts = attack.pathPoints.length >= 2
            ? attack.pathPoints
            : [attack.currentPosition.clone(), attack.toPosition.clone()]
        const geom = new THREE.BufferGeometry().setFromPoints(pts)
        const mat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9,
            linewidth: 2,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
        })
        const beam = new THREE.Line(geom, mat)
        beam.renderOrder = 10
        group.add(beam)
        attack._beamGeom = geom
        attack._beamMat = mat

        // 射线头部光球（飞行指示器）
        const headGeo = new THREE.SphereGeometry(3, 16, 16)
        const headMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
        })
        const head = new THREE.Mesh(headGeo, headMat)
        head.renderOrder = 11
        head.position.copy(attack.currentPosition)
        group.add(head)
        attack._beamHead = head
        attack._beamHeadMat = headMat

        this.manager.add(group)
    }

    // ============ 爆炸创建 ============

    createExplosion(attack: any) {
        const group = new THREE.Group()
        attack.explosionGroup = group

        const pos = attack.toPosition.clone()
        const count = 80
        const geo = new THREE.BufferGeometry()
        const positions = new Float32Array(count * 3)
        const colors = new Float32Array(count * 3)
        const cyan = new THREE.Color('#00ffff')
        const gold = new THREE.Color('#FFD700')
        const baseColor = attack.challengeInfo?.isSuccess !== false ? cyan : new THREE.Color('#ff4444')

        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            positions[i3] = pos.x + (Math.random() - 0.5) * 5
            positions[i3 + 1] = pos.y + (Math.random() - 0.5) * 5
            positions[i3 + 2] = pos.z + (Math.random() - 0.5) * 5
            colors[i3] = baseColor.r + (gold.r - baseColor.r) * Math.random()
            colors[i3 + 1] = baseColor.g + (gold.g - baseColor.g) * Math.random()
            colors[i3 + 2] = baseColor.b + (gold.b - baseColor.b) * Math.random()
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const mat = new THREE.PointsMaterial({
            size: 3, vertexColors: true, transparent: true, opacity: 1,
            blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false,
        })
        const particles = new THREE.Points(geo, mat)
        particles.renderOrder = 12
        group.add(particles)
        attack._explosionGeo = geo
        attack._explosionMat = mat

        // GSAP 驱动爆炸扩散：粒子向外 + 淡出，0.8 秒后自动清理
        const targetPos = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            const angle = Math.random() * Math.PI * 2
            const elevation = (Math.random() - 0.5) * Math.PI
            const dist = 30 + Math.random() * 60
            targetPos[i3] = pos.x + Math.cos(angle) * Math.cos(elevation) * dist
            targetPos[i3 + 1] = pos.y + Math.sin(elevation) * dist
            targetPos[i3 + 2] = pos.z + Math.sin(angle) * Math.cos(elevation) * dist
        }

        gsap.to({ val: 0 }, {
            val: 1,
            duration: 0.8,
            ease: 'power2.out',
            onUpdate: function () {
                const t = this.targets()[0].val
                for (let i = 0; i < count; i++) {
                    const i3 = i * 3
                    positions[i3] += (targetPos[i3] - positions[i3]) * 0.15
                    positions[i3 + 1] += (targetPos[i3 + 1] - positions[i3 + 1]) * 0.15
                    positions[i3 + 2] += (targetPos[i3 + 2] - positions[i3 + 2]) * 0.15
                }
                geo.attributes.position.needsUpdate = true
                mat.opacity = 1 - t
            },
            onComplete: () => {
                this.manager.remove(group)
                geo.dispose(); mat.dispose()
                attack.explosionGroup = null
            }
        })

        this.manager.add(group)
    }

    // ============ 路径计算 ============

    calculateAttackPath(attack: any) {
        const startPos = attack.currentPosition.clone()
        const endPos = attack.toPosition.clone()
        const earthCenter = new THREE.Vector3(0, 0, 0)
        if (this.needsArcPath(startPos, endPos, earthCenter, attack.earthRadius)) {
            attack.pathPoints = this.createArcPath(startPos, endPos, earthCenter, attack.earthRadius)
        } else {
            attack.pathPoints = [startPos, endPos]
        }
    }

    needsArcPath(startPos: THREE.Vector3, endPos: THREE.Vector3, earthCenter: THREE.Vector3, earthRadius: number) {
        const lineDir = new THREE.Vector3().subVectors(endPos, startPos).normalize()
        const lineLen = startPos.distanceTo(endPos)
        const toStart = new THREE.Vector3().subVectors(startPos, earthCenter)
        const projLen = toStart.dot(lineDir)
        const closest = new THREE.Vector3().copy(lineDir).multiplyScalar(projLen).add(startPos)
        const toClosest = new THREE.Vector3().subVectors(closest, startPos)
        const isInRange = toClosest.dot(lineDir) >= 0 && toClosest.length() <= lineLen
        return closest.distanceTo(earthCenter) < earthRadius && isInRange
    }

    createArcPath(startPos: THREE.Vector3, endPos: THREE.Vector3, earthCenter: THREE.Vector3, earthRadius: number) {
        const points: THREE.Vector3[] = []
        const segments = 30
        const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
        const midToCenter = new THREE.Vector3().subVectors(mid, earthCenter)
        const midDist = midToCenter.length()
        const startEndDist = startPos.distanceTo(endPos)
        const safeH = Math.max(earthRadius * 0.4, startEndDist * 0.3)
        const cp = new THREE.Vector3().copy(midToCenter).normalize().multiplyScalar(midDist + safeH).add(earthCenter)
        for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const pt = new THREE.Vector3().copy(startPos).multiplyScalar((1 - t) ** 2)
                .add(cp.clone().multiplyScalar(2 * (1 - t) * t))
                .add(endPos.clone().multiplyScalar(t ** 2))
            if (pt.distanceTo(earthCenter) < earthRadius * 1.05) {
                pt.copy(new THREE.Vector3().subVectors(pt, earthCenter).normalize().multiplyScalar(earthRadius * 1.05))
            }
            points.push(pt)
        }
        return points
    }

    // ============ 每帧更新 ============

    updateAttacks(delta: number) {
        for (let i = this.attacks.length - 1; i >= 0; i--) {
            const attack = this.attacks[i]
            attack.progress += delta / (attack.duration / 1000)
            attack.delta = delta
            if (attack.progress >= 1) {
                this.completeAttack(attack)
                this.attacks.splice(i, 1)
                continue
            }
            this.refreshAttackPath(attack)
            this.updateBeam(attack)
        }
    }

    refreshAttackPath(attack: any) {
        if (!attack.fromSpaceship || !attack.toPosition) return
        const shipPos = new THREE.Vector3()
        attack.fromSpaceship.getWorldPosition(shipPos)
        attack.currentPosition.copy(shipPos)
        if (attack.targetCountry && this.earth) {
            const raw = this.earth.getCountryGeometryCenter?.(attack.targetCountry)
                || this.earth.getCountry3DPosition?.(attack.targetCountry)
            if (raw) attack.toPosition.set(raw.x, raw.y, raw.z)
        }
        const earthCenter = new THREE.Vector3(0, 0, 0)
        if (this.needsArcPath(shipPos, attack.toPosition, earthCenter, attack.earthRadius)) {
            attack.pathPoints = this.createArcPath(shipPos, attack.toPosition, earthCenter, attack.earthRadius)
        } else {
            attack.pathPoints = [shipPos.clone(), attack.toPosition.clone()]
        }
    }

    updateBeam(attack: any) {
        if (!attack.beamGroup) return
        const progress = attack.progress

        // 阶段 1（0-60%）：射线从飞船伸向目标，光球沿路径飞行
        const beamProgress = Math.min(1, progress / 0.6)
        const pts = attack.pathPoints
        if (pts.length >= 2 && attack._beamGeom) {
            // 截取 beamProgress 比例的路径点
            const totalIdx = beamProgress * (pts.length - 1)
            const visiblePts: THREE.Vector3[] = []
            for (let i = 0; i <= Math.floor(totalIdx); i++) {
                visiblePts.push(pts[i].clone())
            }
            const frac = totalIdx - Math.floor(totalIdx)
            if (frac > 0 && Math.floor(totalIdx) < pts.length - 1) {
                const last = new THREE.Vector3().lerpVectors(
                    pts[Math.floor(totalIdx)],
                    pts[Math.floor(totalIdx) + 1],
                    frac
                )
                visiblePts.push(last)
            }
            attack._beamGeom.setFromPoints(visiblePts)
            attack._beamGeom.attributes.position.needsUpdate = true
        }

        // 光球位置：沿路径移动
        if (attack._beamHead && pts.length > 0) {
            const headIdx = Math.min(pts.length - 1, Math.floor(beamProgress * (pts.length - 1)))
            const headFrac = Math.min(1, beamProgress * (pts.length - 1) - headIdx)
            const nextIdx = Math.min(headIdx + 1, pts.length - 1)
            attack._beamHead.position.lerpVectors(pts[headIdx], pts[nextIdx], headFrac)
            attack._beamHead.scale.setScalar(1 + 0.5 * Math.sin(progress * Math.PI * 4))
        }

        // 阶段 2（60-100%）：射线淡出
        if (attack._beamMat) {
            attack._beamMat.opacity = progress > 0.5 ? 0.9 * (1 - (progress - 0.5) / 0.5) : 0.9
        }
        if (attack._beamHeadMat) {
            attack._beamHeadMat.opacity = progress > 0.5 ? 0.9 * (1 - (progress - 0.5) / 0.5) : 0.9
        }
    }

    completeAttack(attack: any) {
        if (attack._explosionDelay) {
            attack._explosionDelay.kill()
            attack._explosionDelay = null
        }
        // 清理射线组
        if (attack.beamGroup) {
            this.manager.remove(attack.beamGroup)
            attack.beamGroup.traverse((child: any) => {
                if (child.geometry) child.geometry.dispose()
                if (child.material) child.material.dispose()
            })
        }
        // 清理爆炸组（GSAP 可能已经清理）
        if (attack.explosionGroup) {
            this.manager.remove(attack.explosionGroup)
            attack.explosionGroup.traverse((child: any) => {
                if (child.geometry) child.geometry.dispose()
                if (child.material) child.material.dispose()
            })
        }
        if (attack.fromSpaceship) attack.fromSpaceship.setActive(false)
    }

    dispose() {
        this.attacks.length = 0
    }
}
