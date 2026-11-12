import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Spaceship from '@/src/globe/spaceships/Spaceship'
import SpaceshipManager from '@/src/globe/spaceships/SpaceshipManager'
import AutoShowcaseSystem from '@/src/globe/camera/AutoShowcaseSystem'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function makeShip() {
  for (const method of ['loadFBXModel', 'createTrail', 'createEngineEffects', 'createRankIndicator', 'createTeamLabel'] as const) {
    vi.spyOn(Spaceship.prototype, method).mockImplementation(() => undefined as never)
  }
  return new Spaceship({ teamId: 1, orbitOffset: 4 * Math.PI / 3 })
}

function makeShowcase() {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 50, -400)
  const controls = {
    target: new THREE.Vector3(), enabled: true, autoRotate: true,
    enableDamping: true, dampingFactor: 0.05, update: vi.fn(),
  }
  const director = {
    camera, controls, isDirecting: false, currentSequence: null as string | null,
    originalState: { position: camera.position.clone(), target: controls.target.clone(),
      autoRotate: true, enableDamping: true, dampingFactor: 0.05 },
    isRunning: () => false,
    saveCurrentState: vi.fn(),
  }
  const ship = new THREE.Object3D() as THREE.Object3D & { teamId: number; rank: number; modelLoaded: boolean; isDisposed: boolean }
  ship.teamId = 1
  ship.rank = 1
  ship.modelLoaded = true
  ship.isDisposed = false
  const manager = { spaceships: new Map([[1, ship]]), setForcedUpdateShipId: vi.fn() }
  return { system: new AutoShowcaseSystem(director, manager), director, manager, ship }
}

describe('orbit and camera lifecycle', () => {
  it('takes the short path across the orbit angle boundary', () => {
    const ship = makeShip() as any
    ship.targetOrbitOffset = 0
    ship.updateOrbitTransition(1 / 60)
    expect(ship.orbitOffset).toBeGreaterThan(4 * Math.PI / 3)
    ship.dispose()
  })

  it('updates placeholder ships while their shared model is loading', () => {
    const manager = new SpaceshipManager()
    const updatePosition = vi.fn()
    manager.spaceships.set(1, { modelLoaded: false, updatePosition })
    manager.update(1 / 60)
    expect(updatePosition).toHaveBeenCalledOnce()
    manager.spaceships.clear()
    manager.dispose()
  })

  it('keeps older trail points fixed in world space as the ship moves', () => {
    const ship = makeShip() as any
    ship.trailGeometry = new THREE.BufferGeometry()
    ship.trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60), 3))
    ship.trailGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(60), 3))
    ship.position.set(100, 0, 0)
    ship.updateTrail()
    ship.position.set(110, 0, 0)
    ship.scale.setScalar(1.1)
    ship.updateTrail()
    const oldPoint = new THREE.Vector3().fromBufferAttribute(ship.trailGeometry.attributes.position, 1)
    expect(ship.localToWorld(oldPoint).x).toBeCloseTo(100)
    ship.dispose()
  })

  it('keeps one pending retry per automatic action and clears it on stop', () => {
    vi.useFakeTimers()
    const { system } = makeShowcase()
    system.isActive = true
    system.userSuppressUntil = Date.now() + 60_000
    for (let i = 0; i < 20; i++) {
      system.scheduleTop3Showcase()
      system.scheduleCameraRotation()
    }
    expect(vi.getTimerCount()).toBe(2)
    system.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not restart a stopped showcase from its delayed callback', () => {
    vi.useFakeTimers()
    const { system, director } = makeShowcase()
    system.isActive = true
    system.startTop3Showcase()
    system.stopTop3Showcase(false)
    vi.advanceTimersByTime(1000)
    expect(director.isDirecting).toBe(false)
    expect(director.controls.enabled).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    system.stop()
  })

  it('does not let an old showcase end timer stop a newer showcase', () => {
    vi.useFakeTimers()
    const { system } = makeShowcase()
    vi.spyOn(system, 'createShowcaseTimeline').mockImplementation(() => undefined)
    system.isActive = true
    system.startTop3Showcase()
    vi.advanceTimersByTime(600)
    system.stopTop3Showcase(false)
    vi.advanceTimersByTime(1000)
    system.startTop3Showcase()
    vi.advanceTimersByTime(28_400)
    expect(system.isShowcasing).toBe(true)
    system.stop()
  })

  it('rejects a detached ship as a follow target', () => {
    const { system, manager, ship } = makeShowcase()
    expect(system.isCurrentShip(ship)).toBe(true)
    manager.spaceships.delete(1)
    expect(system.isCurrentShip(ship)).toBe(false)
  })
})
