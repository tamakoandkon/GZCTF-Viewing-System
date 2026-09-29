/**
 * 把 X-wing FBX 预处理成精简二进制资源（public/models/xwing.ship）
 *
 * 为什么需要：原始 FBX 有 336 个网格 / 118 万顶点，浏览器端解析要 20~30 秒
 * （实测），内存占用高，低配机器会失败 —— 表现就是"只有光晕、看不到飞船"。
 *
 * 预处理做的事（全部在服务器上一次完成）：
 *   1. 解析 FBX，把 336 个子网格按世界矩阵烘焙到同一坐标系
 *   2. 按部件名 + 位置烘焙顶点色（X-wing 涂装）与"队伍色蒙版" aAccent
 *   3. 顶点聚类抽稀（默认网格 6 单位）大幅降低顶点数
 *   4. 量化后写出紧凑二进制：位置 f32 / 法线 i8 / 颜色 u8 / 蒙版 u8 / 索引 u32
 *
 * 运行：node scripts/assets/build-ship-binary.mjs [输入fbx] [输出bin] [聚类网格大小]
 */
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

const SRC = process.argv[2] || 'public/models/xwing.fbx'
const OUT = process.argv[3] || 'public/models/xwing.ship'
const CELL = Number(process.argv[4] || 4) // 聚类网格大小（模型单位；模型最长边约 1090）

// ---- 涂装常量（与 src/globe/Spaceship.ts 保持一致）----
const LIVERY = {
  hull: '#d9d6cd',
  hullDark: '#b9b6ac',
  canopy: '#24272c',
  engineDark: '#34373d',
  cannon: '#9aa0a6',
  cannonTip: '#3a3d42',
}
const MODEL_Z_NOSE = -819
const MODEL_Z_TAIL = 271
const MODEL_LEN = MODEL_Z_TAIL - MODEL_Z_NOSE
const MODEL_HALF_SPAN = 461

const _c = new THREE.Color()
function weatherFactor(x, y, z) {
  const h = Math.sin(x * 0.07) * Math.cos(y * 0.057) * Math.sin(z * 0.031)
  return 0.94 + 0.06 * h
}
/** 返回 1 = 队伍色区域（条纹/短舱环），0 = 用 out 里的固定色 */
function paintVertex(x, y, z, part, out) {
  const t = (z - MODEL_Z_NOSE) / MODEL_LEN
  const ax = Math.abs(x)
  const spanR = ax / MODEL_HALF_SPAN
  if (part.includes('window')) { out.set(LIVERY.canopy); return 0 }
  if (part.includes('rotor') || part.includes('thruster')) { out.set(LIVERY.engineDark); return 0 }
  if (part.includes('engine')) {
    if (t < 0.655) { out.set(LIVERY.engineDark); return 0 }
    if (t >= 0.655 && t < 0.70) { out.set(LIVERY.hull); return 1 }
    out.set(LIVERY.hull); return 0
  }
  if (part.includes('blaster')) { out.set(spanR > 0.93 ? LIVERY.cannonTip : LIVERY.cannon); return 0 }
  if (part.includes('mainwingsurfaces')) {
    if ((spanR > 0.33 && spanR < 0.385) || (spanR > 0.565 && spanR < 0.62)) { out.set(LIVERY.hull); return 1 }
    out.set(y < -20 ? LIVERY.hullDark : LIVERY.hull); return 0
  }
  if (part.includes('body')) {
    if (ax < 62 && t > 0.10 && t < 0.44 && y > 2 && y < 42) { out.set(LIVERY.hull); return 1 }
    out.set(y < -25 ? LIVERY.hullDark : LIVERY.hull); return 0
  }
  out.set(LIVERY.hull)
  return 0
}

// ---------- 1) 解析 FBX，收集三角形（世界坐标 + 顶点色 + 蒙版） ----------
console.log(`解析 ${SRC} …`)
const buf = fs.readFileSync(SRC)
const raw = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '')
raw.rotation.set(0, 0, 0)
raw.updateMatrixWorld(true)

const P = []   // 位置
const C = []   // 颜色 0~1
const A = []   // 队伍色蒙版
let meshCount = 0, srcVerts = 0
raw.traverse((n) => {
  if (!n.isMesh || !n.geometry?.attributes?.position) return
  meshCount++
  const part = String(n.name || '').toLowerCase()
  const g = n.geometry
  const pos = g.attributes.position
  const idx = g.index
  const count = idx ? idx.count : pos.count
  const v = new THREE.Vector3()
  srcVerts += count
  for (let i = 0; i < count; i++) {
    const vi = idx ? idx.getX(i) : i
    v.fromBufferAttribute(pos, vi).applyMatrix4(n.matrixWorld)
    const x = v.x, y = v.y, z = v.z
    const accent = paintVertex(x, y, z, part, _c)
    const w = weatherFactor(x, y, z)
    P.push(x, y, z)
    C.push(_c.r * w, _c.g * w, _c.b * w)
    A.push(accent)
  }
})
console.log(`  原始：${meshCount} 个网格，${(srcVerts / 3).toFixed(0)} 个三角形，${srcVerts.toLocaleString()} 个顶点索引`)

// ---------- 2) 顶点聚类抽稀 ----------
let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
for (let i = 0; i < P.length; i += 3) {
  if (P[i] < minX) minX = P[i]; if (P[i] > maxX) maxX = P[i]
  if (P[i + 1] < minY) minY = P[i + 1]; if (P[i + 1] > maxY) maxY = P[i + 1]
  if (P[i + 2] < minZ) minZ = P[i + 2]; if (P[i + 2] > maxZ) maxZ = P[i + 2]
}
const NX = Math.ceil((maxX - minX) / CELL) + 1
const NY = Math.ceil((maxY - minY) / CELL) + 1
const NZ = Math.ceil((maxZ - minZ) / CELL) + 1
const cellKey = (x, y, z) => {
  const cx = Math.min(NX - 1, Math.max(0, Math.floor((x - minX) / CELL)))
  const cy = Math.min(NY - 1, Math.max(0, Math.floor((y - minY) / CELL)))
  const cz = Math.min(NZ - 1, Math.max(0, Math.floor((z - minZ) / CELL)))
  return cx + cy * NX + cz * NX * NY
}

const cellMap = new Map()   // key -> { sx,sy,sz, sr,sg,sb, sa, n, out }
const remap = new Int32Array(P.length / 3)
for (let i = 0; i < P.length; i += 3) {
  const k = cellKey(P[i], P[i + 1], P[i + 2])
  let c = cellMap.get(k)
  if (!c) { c = { x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, a: 0, n: 0 }; cellMap.set(k, c) }
  c.x += P[i]; c.y += P[i + 1]; c.z += P[i + 2]
  c.r += C[i]; c.g += C[i + 1]; c.b += C[i + 2]
  c.a += A[i / 3]
  c.n++
  remap[i / 3] = k
}
// 为每个非空格子分配新顶点号
const cellIndex = new Map()
const outPos = [], outCol = [], outAcc = []
for (const [k, c] of cellMap) {
  cellIndex.set(k, outPos.length / 3)
  outPos.push(c.x / c.n, c.y / c.n, c.z / c.n)
  outCol.push(c.r / c.n, c.g / c.n, c.b / c.n)
  // 只要格内有条纹顶点就标记为条纹：细条纹不会被邻接机身的平均稀释掉
  outAcc.push(c.a > 0 ? 1 : 0)
}
const outIdx = []
let dropped = 0
for (let i = 0; i < P.length; i += 9) {   // 每 3 个顶点 = 1 个三角形
  const a = cellIndex.get(remap[i / 3])
  const b = cellIndex.get(remap[i / 3 + 1])
  const c = cellIndex.get(remap[i / 3 + 2])
  if (a === b || b === c || a === c) { dropped++; continue }
  outIdx.push(a, b, c)
}
console.log(`  抽稀：网格 ${CELL} 单位 -> ${outPos.length / 3} 个顶点，${outIdx.length / 3} 个三角形（退化丢弃 ${dropped}）`)

// ---------- 3) 法线（按面重算后累加到顶点） ----------
const normals = new Float32Array(outPos.length)
{
  const ax = new THREE.Vector3(), bx = new THREE.Vector3(), cx = new THREE.Vector3()
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3()
  for (let i = 0; i < outIdx.length; i += 3) {
    const i0 = outIdx[i] * 3, i1 = outIdx[i + 1] * 3, i2 = outIdx[i + 2] * 3
    ax.set(outPos[i0], outPos[i0 + 1], outPos[i0 + 2])
    bx.set(outPos[i1], outPos[i1 + 1], outPos[i1 + 2])
    cx.set(outPos[i2], outPos[i2 + 1], outPos[i2 + 2])
    ab.subVectors(bx, ax); ac.subVectors(cx, ax)
    nrm.crossVectors(ab, ac)
    for (const j of [i0, i1, i2]) { normals[j] += nrm.x; normals[j + 1] += nrm.y; normals[j + 2] += nrm.z }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i], y = normals[i + 1], z = normals[i + 2]
    const l = Math.hypot(x, y, z) || 1
    normals[i] = x / l; normals[i + 1] = y / l; normals[i + 2] = z / l
  }
}

// ---------- 4) 写出紧凑二进制 ----------
const vCount = outPos.length / 3
const headerSize = 4 + 4 + 4 + 4 + 4 * 6        // magic, version, count, indexCount, bbox(6)
const posBytes = vCount * 4 * 3                // f32 xyz
const nrmBytes = vCount * 1 * 3                // i8 xyz
const colBytes = vCount * 1 * 3                // u8 rgb
const accBytes = vCount * 1                    // u8
const padBeforeIdx = (4 - ((headerSize + posBytes + nrmBytes + colBytes + accBytes) % 4)) % 4
const idxBytes = outIdx.length * 4             // u32
const total = headerSize + posBytes + nrmBytes + colBytes + accBytes + padBeforeIdx + idxBytes
const out = Buffer.alloc(total)
let o = 0
out.write('SHIP', o); o += 4
out.writeUInt32LE(1, o); o += 4
out.writeUInt32LE(vCount, o); o += 4
out.writeUInt32LE(outIdx.length, o); o += 4
for (const v of [minX, minY, minZ, maxX, maxY, maxZ]) { out.writeFloatLE(v, o); o += 4 }
for (let i = 0; i < outPos.length; i++) { out.writeFloatLE(outPos[i], o); o += 4 }
for (let i = 0; i < normals.length; i++) { out.writeInt8(Math.max(-127, Math.min(127, Math.round(normals[i] * 127))), o); o += 1 }
for (let i = 0; i < outCol.length; i++) { out.writeUInt8(Math.max(0, Math.min(255, Math.round(outCol[i] * 255))), o); o += 1 }
for (let i = 0; i < outAcc.length; i++) { out.writeUInt8(outAcc[i], o); o += 1 }
o += padBeforeIdx   // 对齐到 4 字节，便于浏览器用零拷贝视图读取索引
for (let i = 0; i < outIdx.length; i++) { out.writeUInt32LE(outIdx[i], o); o += 4 }

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out)
const longest = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
console.log(`\n✓ 写出 ${OUT}`)
console.log(`  顶点 ${vCount.toLocaleString()}（原 ${(srcVerts / 3).toFixed(0)} 三角形）  三角形 ${(outIdx.length / 3).toLocaleString()}`)
console.log(`  文件 ${(total / 1048576).toFixed(2)} MB（原 FBX ${(buf.length / 1048576).toFixed(1)} MB）`)
console.log(`  包围盒 min=[${minX.toFixed(1)},${minY.toFixed(1)},${minZ.toFixed(1)}] max=[${maxX.toFixed(1)},${maxY.toFixed(1)},${maxZ.toFixed(1)}] 最长边=${longest.toFixed(1)}`)
console.log(`  中心=[${((minX + maxX) / 2).toFixed(1)},${((minY + maxY) / 2).toFixed(1)},${((minZ + maxZ) / 2).toFixed(1)}]`)
