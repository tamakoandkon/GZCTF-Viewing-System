import * as THREE from 'three'

export default class LightOrbSystem {
    orbs: any[] = []
    scene: THREE.Scene
    earthRadius: number

    constructor(scene: THREE.Scene, earthRadius: number = 100) {
        this.scene = scene
        this.earthRadius = earthRadius
    }

    create() {
        const orbCount = 20
        for (let i = 0; i < orbCount; i++) {
            const orbGeometry = new THREE.SphereGeometry(2, 16, 16)
            const orbMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            })
            const orb = new THREE.Mesh(orbGeometry, orbMaterial)
            const radius = this.earthRadius + 200 + Math.random() * 100
            const angle = Math.random() * Math.PI * 2
            const height = (Math.random() - 0.5) * 200
            orb.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
            orb.userData = {
                originalRadius: radius,
                originalHeight: height,
                originalAngle: angle,
                speed: 0.001,
                pulseSpeed: 0.5 + Math.random() * 1,
                pulsePhase: Math.random() * Math.PI * 2
            }
            this.scene.add(orb)
            this.orbs.push(orb)
        }
    }

    update(delta: number) {
        this.orbs.forEach(orb => {
            const ud = orb.userData
            ud.originalAngle += ud.speed
            orb.position.x = Math.cos(ud.originalAngle) * ud.originalRadius
            orb.position.z = Math.sin(ud.originalAngle) * ud.originalRadius
            orb.position.y = ud.originalHeight + Math.sin(ud.pulsePhase) * 20
            ud.pulsePhase += delta * ud.pulseSpeed
            orb.scale.setScalar(1 + Math.sin(ud.pulsePhase) * 0.3)
            orb.material.opacity = 0.4 + Math.sin(ud.pulsePhase * 0.5) * 0.3
        })
    }

    dispose() {
        this.orbs.forEach(orb => {
            this.scene.remove(orb)
            orb.geometry.dispose()
            orb.material.dispose()
        })
        this.orbs = []
    }
}
