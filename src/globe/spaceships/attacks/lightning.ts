import * as THREE from 'three';

import { getChallengeColor } from './palette';

export function createLightningAttack(parent: THREE.Object3D, attack: any): void {
        const pathPoints = attack.pathPoints;
        if (pathPoints.length < 2) return;
        
        const challengeColor = getChallengeColor(attack.challengeInfo.challengeCategory);
        
        // 创建闪电链路径（添加安全的随机折点）
        const lightningPoints = [];
        for (let i = 0; i < pathPoints.length; i++) {
            const point = pathPoints[i].clone();
            
            // 在中间点添加随机偏移，但要确保不会太靠近地球
            if (i > 0 && i < pathPoints.length - 1) {
                // 计算点到地球中心的方向
                const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), point);
                const distanceToCenter = point.length();
                
                // 只在远离地球的方向添加偏移
                const safeOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * 8,  // 从15减小到8，减少偏移量
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8
                );
                
                // 确保偏移不会让点太接近地球
                const newPoint = point.clone().add(safeOffset);
                if (newPoint.length() > attack.earthRadius * 1.02) {
                    point.copy(newPoint);
                }
            }
            lightningPoints.push(point);
        }
        
        // 创建闪电几何体
        const lightningGeometry = new THREE.BufferGeometry().setFromPoints(lightningPoints);
        const lightningMaterial = new THREE.LineBasicMaterial({
            color: new THREE.Color(challengeColor),
            transparent: true,
            opacity: 0.85, // 从0.9减小到0.85，稍微柔和
            linewidth: 2,  // 从3减小到2，更细致
            depthTest: true,
            depthWrite: false
        });
        
        const lightningBeam = new THREE.Line(lightningGeometry, lightningMaterial);
        lightningBeam.renderOrder = 10;
        
        attack.lightningGeometry = lightningGeometry;
        attack.lightningMaterial = lightningMaterial;
        attack.lightningBeam = lightningBeam;
        attack.lightningPoints = pathPoints; // 保存原始路径用于重新生成
        attack.lightningUpdateCounter = 0;
        
        parent.add(lightningBeam);
        attack.objects.push(lightningBeam);
    }

export function updateLightningAttack(attack: any, delta: number): void {
        if (!attack.lightningBeam) return;
        
        const progress = attack.progress;
        
        // 每隔一定时间重新生成闪电路径，制造动态效果
        attack.lightningUpdateCounter = (attack.lightningUpdateCounter || 0) + delta;
        if (attack.lightningUpdateCounter > 0.05) { // 每50ms更新一次
            attack.lightningUpdateCounter = 0;
            
            // 重新生成闪电路径（安全版本）
            const lightningPoints = [];
            for (let i = 0; i < attack.lightningPoints.length; i++) {
                const point = attack.lightningPoints[i].clone();
                
                // 在中间点添加随机偏移，但确保安全
                if (i > 0 && i < attack.lightningPoints.length - 1) {
                    const intensity = Math.sin(progress * Math.PI); // 中间最强
                    const safeOffset = new THREE.Vector3(
                        (Math.random() - 0.5) * 8 * intensity,  // 从15减小到8
                        (Math.random() - 0.5) * 8 * intensity,
                        (Math.random() - 0.5) * 8 * intensity
                    );
                    
                    // 验证新位置不会太靠近地球
                    const newPoint = point.clone().add(safeOffset);
                    if (newPoint.length() > attack.earthRadius * 1.02) {
                        point.copy(newPoint);
                    }
                }
                lightningPoints.push(point);
            }
            
            // 更新几何体
            attack.lightningGeometry.setFromPoints(lightningPoints);
            attack.lightningGeometry.attributes.position.needsUpdate = true;
        }
        
        // 更新透明度和闪烁效果
        const flicker = Math.random() > 0.7 ? 0.6 : 1; // 随机闪烁，从0.5改为0.6
        attack.lightningMaterial.opacity = 0.85 * (1 - progress * 0.3) * flicker;
    }
