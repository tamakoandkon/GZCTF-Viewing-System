import * as THREE from 'three'

interface ParticleConfig {
  count: number
  radius: number
  color: string
  size: number
  opacity: number
}

interface Particle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
}

export class ParticleSystem {
  group = new THREE.Group()
  private particles: Particle[] = []
  private points: THREE.Points
  private positions: Float32Array
  private colors: Float32Array
  private sizes: Float32Array
  private geometry: THREE.BufferGeometry

  constructor(config: ParticleConfig) {
    const { count, radius, color, size, opacity } = config

    this.geometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.sizes = new Float32Array(count)

    const baseColor = new THREE.Color(color)

    for (let i = 0; i < count; i++) {
      // Random position on sphere surface
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * (0.8 + Math.random() * 0.4)

      this.positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      this.positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      this.positions[i * 3 + 2] = r * Math.cos(phi)

      this.colors[i * 3] = baseColor.r
      this.colors[i * 3 + 1] = baseColor.g
      this.colors[i * 3 + 2] = baseColor.b

      this.sizes[i] = size * (0.5 + Math.random() * 1.5)

      this.particles.push({
        position: new THREE.Vector3(
          this.positions[i * 3],
          this.positions[i * 3 + 1],
          this.positions[i * 3 + 2]
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        life: Math.random(),
        maxLife: 1 + Math.random()
      })
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))

    const material = new THREE.PointsMaterial({
      size: size * 2,
      vertexColors: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.points = new THREE.Points(this.geometry, material)
    this.group.add(this.points)
  }

  update(delta: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      p.life += delta
      if (p.life > p.maxLife) {
        p.life = 0
      }

      // Subtle movement outward
      const idx = i * 3
      this.positions[idx] += p.velocity.x * delta * 0.1
      this.positions[idx + 1] += p.velocity.y * delta * 0.1
      this.positions[idx + 2] += p.velocity.z * delta * 0.1
    }

    this.geometry.attributes.position.needsUpdate = true
  }

  dispose() {
    this.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
  }
}
