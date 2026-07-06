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

const cameraDirector = { camera, controls, saveCurrentState() {}, originalState: { position: camera.position.clone(), target: controls.target.clone() } }
const spaceshipManager = {
  earthRadius: 100,
  earth: { radius: 100 },
  spaceships: new Map(),
  setForcedUpdateShipId() {},
}

const system = new AutoShowcaseSystem(cameraDirector, spaceshipManager)
system.isShowcasing = true

const makeShip = (id, rank) => {
  const shipRoot = new THREE.Object3D()
  shipRoot.modelLoaded = true
  shipRoot.size = 1
  shipRoot.teamId = id
  shipRoot.rank = rank
  shipRoot.spaceshipMesh = new THREE.Object3D()
  shipRoot.add(shipRoot.spaceshipMesh)
  spaceshipManager.spaceships.set(id, shipRoot)
  return shipRoot
}

const s1 = makeShip(1, 1)
const s2 = makeShip(2, 2)
const s3 = makeShip(3, 3)

system.currentShowcaseSpaceships = [s1, s2, s3]

let angle = 0
let dt = 1 / 60

const stepShips = () => {
  angle += 1.2 * dt
  const r = 220

  ;[s1, s2, s3].forEach((s, idx) => {
    const a = angle + idx * 1.3
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const y = Math.sin(a * 2) * 18
    s.spaceshipMesh.position.set(x, y, z)
    const yaw = Math.atan2(Math.cos(a), -Math.sin(a))
    const roll = Math.sin(a * 3) * 0.9
    s.spaceshipMesh.rotation.set(0, yaw, roll)
  })
}

system.startTransitionToSpaceship(s1, 1.0)
system.shouldFollow = true
system.currentFollowingSpaceship = s1
system.followEndTime = performance.now() + 30_000

for (let i = 0; i < 60 * 8; i++) {
  if (i % 120 === 0) dt = 1 / 15
  else dt = 1 / 60

  stepShips()

  if (i === 120) system.startTransitionToSpaceship(s2, 1.0)
  if (i === 240) s2.modelLoaded = false
  if (i === 360) system.startTransitionToSpaceship(s3, 1.0)

  system.update(dt)

  const ok =
    Number.isFinite(camera.position.x) &&
    Number.isFinite(camera.position.y) &&
    Number.isFinite(camera.position.z) &&
    Number.isFinite(controls.target.x) &&
    Number.isFinite(controls.target.y) &&
    Number.isFinite(controls.target.z)
  if (!ok) throw new Error("Non-finite camera/target values")
}

console.log("top3-follow-switch-sim ok", {
  cameraPos: camera.position.toArray(),
  target: controls.target.toArray(),
})

