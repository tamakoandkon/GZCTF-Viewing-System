import * as THREE from "three"
import AutoShowcaseSystem from "../src/globe/AutoShowcaseSystem.js"

const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 5000)
camera.position.set(0, 180, 360)

const controls = {
  target: new THREE.Vector3(0, 0, 0),
  enabled: false,
  autoRotate: false,
  enableDamping: false,
  dampingFactor: 0.1,
  update() {},
}

const cameraDirector = { camera, controls }
const spaceshipManager = { earthRadius: 100, setForcedUpdateShipId() {} }
const system = new AutoShowcaseSystem(cameraDirector, spaceshipManager)

system.isShowcasing = true
system.shouldFollow = true
system.isTransitioning = false
system.followEndTime = performance.now() + 30_000

const shipRoot = new THREE.Object3D()
shipRoot.modelLoaded = true
shipRoot.size = 1
shipRoot.teamId = 1
shipRoot.spaceshipMesh = new THREE.Object3D()
shipRoot.add(shipRoot.spaceshipMesh)
system.currentFollowingSpaceship = shipRoot

let angle = 0
let speed = 0.9
let dt = 1 / 60

const run = (frames, mode) => {
  for (let i = 0; i < frames; i++) {
    if (mode === "variable_dt") {
      if (i % 240 === 0) dt = 1 / 15
      else if (i % 120 === 0) dt = 1 / 10
      else if (i % 60 === 0) dt = 1 / 30
      else dt = 1 / 60
    }
    if (mode === "hard_turns") {
      if (i === 180) speed = 3.2
      if (i === 260) speed = -2.6
      if (i === 320) speed = 1.2
      if (i === 420) speed = 0.3
      if (i === 520) speed = 2.8
    } else {
      if (i === 240) speed = 2.8
      if (i === 420) speed = 0.4
      if (i === 660) speed = 1.6
    }

    angle += speed * dt
    const r = 220
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r
    const y = Math.sin(angle * 2) * 18

    shipRoot.spaceshipMesh.position.set(x, y, z)

    const yaw = Math.atan2(Math.cos(angle), -Math.sin(angle))
    const roll = Math.sin(angle * 3) * 0.9
    shipRoot.spaceshipMesh.rotation.set(0, yaw, roll)

    system.update(dt)

    const ok =
      Number.isFinite(camera.position.x) &&
      Number.isFinite(camera.position.y) &&
      Number.isFinite(camera.position.z) &&
      Number.isFinite(camera.quaternion.x) &&
      Number.isFinite(camera.quaternion.y) &&
      Number.isFinite(camera.quaternion.z) &&
      Number.isFinite(camera.quaternion.w)
    if (!ok) {
      throw new Error("Camera produced non-finite values")
    }
  }
}

run(60 * 10, "steady")
system.setFollowParams({ predictionAccelFactor: 0.9, leadTime: 0.16 })
run(60 * 10, "variable_dt")
run(60 * 12, "hard_turns")

console.log("camera-follow-sim ok", {
  cameraPos: camera.position.toArray(),
  target: controls.target.toArray(),
})

