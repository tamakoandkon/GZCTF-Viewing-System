// @ts-nocheck
import * as THREE from 'three'

/**
 * ArcSystem — 飞线/弧线动画子系统
 * 从 Earth-github.ts 提取，管理全球贸易飞线的创建和动画更新
 */
export default class ArcSystem {
    earth: any          // Earth 实例引用
    radius: number
    config: any
    materialManager: any
    arcsData: any[]
    arcsGroup: THREE.Group
    arcUpdateIndex: number = 0
    disposed: boolean = false

    constructor(earth: any) {
        this.earth = earth
        this.radius = earth.radius
        this.config = earth.config
        this.materialManager = earth.materialManager
        this.arcsData = earth.config.arcsData || []
    }

    createArcs() {
        this.arcsGroup = new THREE.Group()
        this.arcsGroup.name = 'Arcs'
        this.arcsData.forEach((arc, index) => this.createArc(arc, index))
        this.earth.add(this.arcsGroup)
    }

    createArc(arc: any, index: number) {
        const startPos = this.earth.latLngToVector3(arc.startLat, arc.startLng, this.radius)
        const endPos = this.earth.latLngToVector3(arc.endLat, arc.endLng, this.radius)
        const angle = startPos.angleTo(endPos)
        const arcHeight = this.radius * (arc.arcAlt ?? 0.1)
        const angleThreshold = Math.PI / 3
        const curve = this.createCurve(startPos, endPos, angle, arcHeight, angleThreshold)
        const points = curve.getPoints(100)

        const arcGroup = new THREE.Group()

        const staticGeometry = new THREE.BufferGeometry().setFromPoints(points)
        const staticMaterial = this.materialManager.getLineMaterial(arc.color || '#ffffff', 0.2, true)
        const staticLine = new THREE.Line(staticGeometry, staticMaterial)
        staticLine.renderOrder = 4
        arcGroup.add(staticLine)

        const flyingGeometry = new THREE.BufferGeometry()
        const flyingMaterial = this.materialManager.getFlyingLineMaterial(arc.color || '#ffffff')
        const flyingLine = new THREE.Line(flyingGeometry, flyingMaterial)
        flyingLine.renderOrder = 5
        arcGroup.add(flyingLine)

        let particle = null
        if (this.config.showFlyingParticle) {
            particle = this.createParticle(arc.color)
            arcGroup.add(particle)
        }

        arcGroup.userData = {
            arc, index, points, flyingGeometry, particle,
            animationOffset: index * (this.config.arcTime / this.arcsData.length),
            flyingLength: this.config.flyingLineLength,
            totalPoints: points.length,
            pointsPerProgress: points.length - 2,
            positionBuffer: new Float32Array(this.config.flyingLineLength * 3),
            colorBuffer: new Float32Array(this.config.flyingLineLength * 3),
            lastVisibleCount: 0
        }

        this.arcsGroup.add(arcGroup)
    }

    createCurve(startPos: THREE.Vector3, endPos: THREE.Vector3, angle: number, arcHeight: number, angleThreshold: number) {
        const safeArcHeight = (arcHeight != null && !isNaN(arcHeight)) ? arcHeight : 0.1
        if (angle > angleThreshold) {
            const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
            midPoint.normalize().multiplyScalar(this.radius + safeArcHeight)
            const controlPoint1 = new THREE.Vector3().lerpVectors(startPos, midPoint, 0.5)
            controlPoint1.normalize().multiplyScalar(this.radius + safeArcHeight)
            const controlPoint2 = new THREE.Vector3().lerpVectors(midPoint, endPos, 0.5)
            controlPoint2.normalize().multiplyScalar(this.radius + safeArcHeight)
            return new THREE.CubicBezierCurve3(startPos, controlPoint1, controlPoint2, endPos)
        } else {
            const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
            midPoint.normalize().multiplyScalar(this.radius + safeArcHeight)
            return new THREE.QuadraticBezierCurve3(startPos, midPoint, endPos)
        }
    }

    createParticle(color: string) {
        const geometry = new THREE.SphereGeometry(this.config.particleSize, 8, 8)
        const material = this.materialManager.getPointMaterial(color || '#ffffff', this.config.particleSize, true, 0.8)
        return new THREE.Mesh(geometry, material)
    }

    updateArcsAnimationBatch(currentTime: number) {
        if (!this.arcsGroup || this.arcsGroup.children.length === 0) return
        const totalArcs = this.arcsGroup.children.length
        if (totalArcs === 0) return

        let maxArcsPerFrame: number
        if (totalArcs <= 20) maxArcsPerFrame = totalArcs
        else if (totalArcs <= 50) maxArcsPerFrame = Math.max(10, Math.ceil(totalArcs / 3))
        else maxArcsPerFrame = Math.max(15, Math.ceil(totalArcs / 4))

        const startIndex = this.arcUpdateIndex % totalArcs
        const endIndex = Math.min(startIndex + maxArcsPerFrame, totalArcs)

        for (let i = startIndex; i < endIndex; i++) {
            const arcGroup = this.arcsGroup.children[i]
            const userData = arcGroup.userData
            if (!userData || !userData.points) continue

            const animationTime = (currentTime * 1000 + userData.animationOffset) % this.config.arcTime
            const progress = animationTime / this.config.arcTime
            this.updateFlyingLineOptimized(arcGroup, progress)
            if (userData.particle) {
                this.updateParticleOptimized(arcGroup, progress, Math.sin(currentTime * 30.0))
            }
        }

        this.arcUpdateIndex = endIndex >= totalArcs ? 0 : endIndex
    }

    updateFlyingLineOptimized(arcGroup: any, progress: number) {
        const userData = arcGroup.userData
        const { points, flyingGeometry, flyingLength, totalPoints } = userData
        if (!points || totalPoints === 0) return

        const currentIndex = Math.floor(progress * totalPoints)
        const startIndex = Math.max(0, currentIndex - flyingLength)
        const endIndex = Math.min(totalPoints - 1, currentIndex)

        if (startIndex >= endIndex) {
            if (userData.lastVisibleCount > 0) {
                userData.lastVisibleCount = 0
                flyingGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
                flyingGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 3))
                flyingGeometry.setDrawRange(0, 0)
            }
            return
        }

        const pointCount = endIndex - startIndex + 1
        const posBuffer = userData.positionBuffer
        const colorBuffer = userData.colorBuffer

        for (let i = 0; i < pointCount; i++) {
            const point = points[startIndex + i]
            const bi = i * 3
            posBuffer[bi] = point.x; posBuffer[bi + 1] = point.y; posBuffer[bi + 2] = point.z
            const intensity = i / (pointCount - 1)
            colorBuffer[bi] = intensity; colorBuffer[bi + 1] = intensity; colorBuffer[bi + 2] = intensity
        }

        if (userData.lastVisibleCount !== pointCount) {
            flyingGeometry.setAttribute('position', new THREE.BufferAttribute(posBuffer.slice(0, pointCount * 3), 3))
            flyingGeometry.setAttribute('color', new THREE.BufferAttribute(colorBuffer.slice(0, pointCount * 3), 3))
            flyingGeometry.setDrawRange(0, pointCount)
            userData.lastVisibleCount = pointCount
        } else {
            const pa = flyingGeometry.attributes.position
            const ca = flyingGeometry.attributes.color
            if (pa && ca) {
                pa.array.set(posBuffer.subarray(0, pointCount * 3)); pa.needsUpdate = true
                ca.array.set(colorBuffer.subarray(0, pointCount * 3)); ca.needsUpdate = true
            }
        }
    }

    updateParticleOptimized(arcGroup: any, progress: number, sinParticleTime: number) {
        const { points, particle, pointsPerProgress } = arcGroup.userData
        if (!points || points.length === 0 || !particle) return

        const currentIndex = Math.floor(progress * pointsPerProgress)
        const nextIndex = Math.min(currentIndex + 1, pointsPerProgress)
        if (currentIndex >= pointsPerProgress) { particle.visible = false; return }
        particle.visible = true

        const localProgress = (progress * pointsPerProgress) - currentIndex
        const tempVector = this.earth.animationCache.tempVector
        tempVector.lerpVectors(points[currentIndex], points[nextIndex], localProgress)
        particle.position.copy(tempVector)
        particle.scale.setScalar(1 + 0.5 * sinParticleTime)
        particle.material.opacity = 0.8 * Math.sin(progress * Math.PI)
    }

    updateArcsData(newArcsData: any[]) {
        this.arcsData = newArcsData
        if (this.arcsGroup) {
            this.earth.remove(this.arcsGroup)
            this.arcsGroup.traverse((child: any) => { if (child.geometry) child.geometry.dispose() })
        }
        if (newArcsData.length > 0) this.createArcs()
    }

    dispose() {
        if (this.disposed) return
        this.disposed = true
        if (this.arcsGroup) {
            this.arcsGroup.traverse((child: any) => {
                if (child.geometry) child.geometry.dispose()
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
                    else child.material.dispose()
                }
            })
        }
        this.arcsData = []
    }
}
