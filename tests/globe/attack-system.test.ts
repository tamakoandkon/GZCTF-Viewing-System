import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AttackSystem from '@/src/globe/spaceships/attacks/AttackSystem'

function createHost() {
  const ship = new THREE.Object3D() as THREE.Object3D & { setActive: (active: boolean) => void }
  ship.setActive = vi.fn()
  const earth = {
    getCountryGeometryCenter: () => ({ x: 100, y: 0, z: 0 }),
    localToWorld: (point: THREE.Vector3) => point,
    highlightCountry: vi.fn(),
  }
  return {
    host: {
      spaceships: new Map([[1, ship]]),
      earth,
      earthRadius: 100,
      deviceCapabilities: { isMobile: false },
    },
    ship,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AttackSystem', () => {
  it('creates and updates all four attack effects without throwing', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.01).mockReturnValueOnce(0.26).mockReturnValueOnce(0.51).mockReturnValueOnce(0.76)
    const { host, ship } = createHost()
    const system = new AttackSystem(host as any)

    for (let i = 0; i < 4; i++) {
      expect(() =>
        system.createAttack(1, 'India', {
          challengeCategory: 'Web',
          challengeTitle: 'SQLi',
          isSuccess: true,
        }),
      ).not.toThrow()
    }

    expect(system.children.length).toBeGreaterThan(0)
    expect(() => system.update(0.2)).not.toThrow()
    expect(() => system.update(3)).not.toThrow()
    expect(ship.setActive).toHaveBeenCalledWith(true)

    system.clearAll()
    expect(system.children.length).toBe(0)
    system.dispose()
  })

  it('ignores attacks from a team without a spaceship', () => {
    const { host } = createHost()
    const system = new AttackSystem(host as any)
    expect(system.createAttack(999, 'India', { challengeCategory: 'Web' })).toBeUndefined()
    expect(system.children.length).toBe(0)
    system.dispose()
  })
})
