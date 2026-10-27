import * as THREE from 'three';

/** 经纬度转地球局部坐标。与 Earth 的 SphereGeometry 朝向保持一致。 */
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
}

export interface LatLngPoint {
    lat: number;
    lng: number;
}

export function removeDuplicatePoints<T extends LatLngPoint>(points: T[]): T[] {
    const seen = new Set<string>();
    return points.filter((point) => {
        const key = `${point.lat},${point.lng}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * 填充网格顶点的算术平均。顶点在球面上，平均值会落在球内；
 * 调用方需要再归一化到目标半径。
 */
export function getMeshesCenter(meshes: THREE.Mesh[]): THREE.Vector3 | null {
    const center = new THREE.Vector3();
    let vertexCount = 0;

    for (const mesh of meshes) {
        const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
        const attribute = geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!attribute) continue;

        const positions = attribute.array as ArrayLike<number>;
        for (let i = 0; i < positions.length; i += 3) {
            center.x += positions[i];
            center.y += positions[i + 1];
            center.z += positions[i + 2];
            vertexCount++;
        }
    }

    if (vertexCount === 0) return null;
    return center.divideScalar(vertexCount);
}
