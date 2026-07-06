import * as THREE from 'three'
import { ParticleSystem } from './ParticleSystem'

/**
 * CeremonySystem — 仪式感的入场动画
 * 在地球显示时，用粒子 + 光晕创造一个"展开"的视觉效果
 */
export class CeremonySystem {
  private group = new THREE.Group()
  private particles: ParticleSystem
  private glowMesh: THREE.Mesh
  private ring: THREE.Mesh
  private progress = 0
  private isActive = false

  constructor(private scene: THREE.Scene) {
    this.particles = new ParticleSystem({
      count: 3000,
      radius: 12,
      color: '#4a6cf7',
      size: 0.03,
      opacity: 0.8
    })

    // 光晕环
    const ringGeo = new THREE.RingGeometry(2.8, 3.2, 64)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4a6cf7,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    })
    this.ring = new THREE.Mesh(ringGeo, ringMat)
    this.ring.rotation.x = -Math.PI / 2

    // 中心 glow
    const glowGeo = new THREE.SphereGeometry(3.2, 32, 32)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4a6cf7,
      transparent: true,
      opacity: 0
    })
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat)

    this.group.add(this.particles.group)
    this.group.add(this.ring)
    this.group.add(this.glowMesh)
  }

  start() {
    this.isActive = true
    this.progress = 0
    this.scene.add(this.group)
  }

  update(delta: number) {
    if (!this.isActive) return
    this.progress = Math.min(this.progress + delta * 0.5, 1)

    const t = this.progress
    // Ease out cubic
    const ease = 1 - Math.pow(1 - t, 3)

    this.particles.update(delta)
    this.particles.group.rotation.y += delta * 0.2

    // 光晕出现并消失
    const glowOpacity = Math.sin(ease * Math.PI) * 0.4
    this.glowMesh.material.opacity = glowOpacity
    this.ring.material.opacity = ease * 0.3
    this.ring.scale.setScalar(1 + ease * 0.5)

    if (this.progress >= 1) {
      this.isActive = false
    }
  }

  stop() {
    this.isActive = false
    this.scene.remove(this.group)
  }
}
