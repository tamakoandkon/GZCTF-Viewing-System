import * as THREE from 'three';

export function calculateAttackPath(attack: any): void {
        const startPos = attack.currentPosition.clone();
        const endPos = attack.toPosition.clone();
        const earthCenter = new THREE.Vector3(0, 0, 0);
        
        // 计算直线距离
        const directDistance = startPos.distanceTo(endPos);
        
        // 检查是否需要绕过地球
        const requiresArc = needsArcPath(startPos, endPos, earthCenter, attack.earthRadius);
        
        if (requiresArc) {
            // 创建弧形路径绕过地球
            attack.pathPoints = createArcPath(startPos, endPos, earthCenter, attack.earthRadius);
        } else {
            // 使用直线路径
            attack.pathPoints = [startPos, endPos];
        }
        
        console.log(`Attack path calculated: ${attack.pathPoints.length} points, arc: ${requiresArc}`);
    
}

export function needsArcPath(startPos: THREE.Vector3, endPos: THREE.Vector3, earthCenter: THREE.Vector3, earthRadius: number): boolean {
        // 计算直线路径是否与地球相交
        const lineDirection = new THREE.Vector3().subVectors(endPos, startPos).normalize();
        const lineLength = startPos.distanceTo(endPos);
        
        // 计算地球中心到直线的最近点
        const toStart = new THREE.Vector3().subVectors(startPos, earthCenter);
        const projectionLength = toStart.dot(lineDirection);
        const closestPoint = new THREE.Vector3()
            .copy(lineDirection)
            .multiplyScalar(projectionLength)
            .add(startPos);
        
        // 检查最近点是否在地球内部
        const distanceToEarth = closestPoint.distanceTo(earthCenter);
        const isInsideEarth = distanceToEarth < earthRadius;
        
        // 检查最近点是否在路径范围内
        const toClosest = new THREE.Vector3().subVectors(closestPoint, startPos);
        const isInRange = toClosest.dot(lineDirection) >= 0 && toClosest.length() <= lineLength;
        
        return isInsideEarth && isInRange;
    }


export function createArcPath(startPos: THREE.Vector3, endPos: THREE.Vector3, earthCenter: THREE.Vector3, earthRadius: number): THREE.Vector3[] {
        const points = [];
        const segments = 30; // 增加分段数，使路径更平滑
        
        // 计算两点的中点
        const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
        
        // 计算弧形控制点：向外推出，确保远离地球表面
        // 使用中点到地球中心的方向，向外推出
        const midToCenter = new THREE.Vector3().subVectors(midPoint, earthCenter);
        const midDistance = midToCenter.length();
        
        // 计算安全的弧形高度：确保控制点在地球外部
        // 使用起点和终点的距离来决定弧形高度
        const startEndDistance = startPos.distanceTo(endPos);
        const safeHeight = Math.max(earthRadius * 0.4, startEndDistance * 0.3); // 至少40%地球半径或30%路径长度
        
        // 控制点：沿着中点的法向量向外推
        const controlPoint = new THREE.Vector3()
            .copy(midToCenter)
            .normalize()
            .multiplyScalar(midDistance + safeHeight)
            .add(earthCenter);
        
        // 生成平滑的二次贝塞尔曲线路径
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            
            // 二次贝塞尔曲线公式
            const point = new THREE.Vector3()
                .copy(startPos)
                .multiplyScalar((1 - t) * (1 - t))
                .add(controlPoint.clone().multiplyScalar(2 * (1 - t) * t))
                .add(endPos.clone().multiplyScalar(t * t));
            
            // 验证点不在地球内部
            const distanceFromCenter = point.distanceTo(earthCenter);
            if (distanceFromCenter < earthRadius * 1.05) {
                // 如果点太接近地球，向外推出
                const direction = new THREE.Vector3().subVectors(point, earthCenter).normalize();
                point.copy(direction.multiplyScalar(earthRadius * 1.05));
            }
            
            points.push(point);
        }
        
        console.log(`Created arc path with ${points.length} points, safe height: ${safeHeight.toFixed(2)}`);
        return points;
    }

