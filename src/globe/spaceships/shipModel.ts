import * as THREE from 'three';

// 模型已由 scripts/assets/build-ship-binary.mjs 预处理为精简二进制。
// 浏览器端只做零拷贝读取，不再现场解析 11MB FBX。
export const MODEL_BIN_URL = '/models/xwing.ship';

export interface ShipPrototype {
    geometry: THREE.BufferGeometry;
    longest: number;
    center: THREE.Vector3;
}

// 共享原型：全局只加载一次，所有飞船复用同一份几何体
let prototypePromise: Promise<ShipPrototype> | null = null;
let sharedPrototypeGeometry: THREE.BufferGeometry | null = null;
let prototypeGeneration = 0;

export function buildSpaceshipPrototype(): Promise<ShipPrototype> {
    if (!prototypePromise) {
        const generation = prototypeGeneration;
        prototypePromise = (async () => {
            const t0 = performance.now();
            const res = await fetch(MODEL_BIN_URL);
            if (!res.ok) throw new Error(`模型资源加载失败: HTTP ${res.status}`);
            const ab = await res.arrayBuffer();
            const dv = new DataView(ab);
            const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
            if (magic !== 'SHIP') throw new Error('模型资源格式不正确（应由 build-ship-binary.mjs 生成）');

            const count = dv.getUint32(8, true);
            const indexCount = dv.getUint32(12, true);
            const minX = dv.getFloat32(16, true), minY = dv.getFloat32(20, true), minZ = dv.getFloat32(24, true);
            const maxX = dv.getFloat32(28, true), maxY = dv.getFloat32(32, true), maxZ = dv.getFloat32(36, true);

            let off = 40;
            const pos = new Float32Array(ab, off, count * 3); off += count * 12;
            const nrm = new Int8Array(ab, off, count * 3); off += count * 3;
            const col = new Uint8Array(ab, off, count * 3); off += count * 3;
            const acc = new Uint8Array(ab, off, count); off += count;
            off += (4 - (off % 4)) % 4;
            const idx = new Uint32Array(ab, off, indexCount);

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
            geometry.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
            geometry.setAttribute('aAccent', new THREE.BufferAttribute(acc, 1, false));
            geometry.setIndex(new THREE.BufferAttribute(idx, 1));

            if (generation !== prototypeGeneration) {
                geometry.dispose();
                throw new Error('飞船模型加载已取消');
            }
            sharedPrototypeGeometry = geometry;

            const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
            const longest = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
            return { geometry, longest, center };
        })().catch((error) => {
            if (generation === prototypeGeneration) prototypePromise = null;
            throw error;
        });
    }
    return prototypePromise;
}

export function isSharedShipGeometry(geometry: THREE.BufferGeometry | undefined): boolean {
    return geometry !== undefined && geometry === sharedPrototypeGeometry;
}

export function disposeSpaceshipPrototype(): void {
    prototypeGeneration += 1;
    sharedPrototypeGeometry?.dispose();
    sharedPrototypeGeometry = null;
    prototypePromise = null;
}
