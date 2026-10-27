import * as THREE from 'three';

import { getChallengeColor } from './palette';

export function createParticleFloodAttack(parent: THREE.Object3D, attack: any): void {
        const pathPoints = attack.pathPoints;
        if (pathPoints.length < 2) return;
        
        const challengeColor = getChallengeColor(attack.challengeInfo.challengeCategory);
        
        // 创建适量粒子（从200减少到100）
        const particleCount = 100;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const velocities = new Float32Array(particleCount * 3);
        
        const baseColor = new THREE.Color(challengeColor);
        const startPos = pathPoints[0];
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // 初始位置在飞船处，略微分散
            positions[i3] = startPos.x + (Math.random() - 0.5) * 3; // 从5减小到3
            positions[i3 + 1] = startPos.y + (Math.random() - 0.5) * 3;
            positions[i3 + 2] = startPos.z + (Math.random() - 0.5) * 3;
            
            // 颜色变化
            const colorVariation = 0.7 + Math.random() * 0.3;
            colors[i3] = baseColor.r * colorVariation;
            colors[i3 + 1] = baseColor.g * colorVariation;
            colors[i3 + 2] = baseColor.b * colorVariation;
            
            sizes[i] = Math.random() * 1.5 + 0.3; // 从2+0.5减小到1.5+0.3
            
            // 速度（沿路径方向）
            const speedVariation = 0.8 + Math.random() * 0.4;
            velocities[i3] = attack.direction.x * speedVariation;
            velocities[i3 + 1] = attack.direction.y * speedVariation;
            velocities[i3 + 2] = attack.direction.z * speedVariation;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 1.5, // 从2减小到1.5
            vertexColors: true,
            transparent: true,
            opacity: 0.85, // 从0.8增加到0.85
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false
        });
        
        const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        particleSystem.renderOrder = 10;
        
        parent.add(particleSystem);
        attack.objects.push(particleSystem);
        
        attack.particleFlood = particleSystem;
        attack.particleFloodGeometry = particleGeometry;
        attack.floodStartPos = startPos.clone();
    }

export function updateParticleFloodAttack(attack: any, delta: number): void {
        if (!attack.particleFlood || !attack.particleFloodGeometry) return;
        
        const progress = attack.progress;
        const positions = attack.particleFloodGeometry.attributes.position.array;
        const velocities = attack.particleFloodGeometry.attributes.velocity.array;
        const particleCount = positions.length / 3;
        
        // 更新粒子位置
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // 沿路径方向移动
            const newX = positions[i3] + velocities[i3] * delta * 100;
            const newY = positions[i3 + 1] + velocities[i3 + 1] * delta * 100;
            const newZ = positions[i3 + 2] + velocities[i3 + 2] * delta * 100;
            
            // 添加一些随机扰动
            const disturbX = (Math.random() - 0.5) * 0.3; // 从0.5减小到0.3
            const disturbY = (Math.random() - 0.5) * 0.3;
            const disturbZ = (Math.random() - 0.5) * 0.3;
            
            // 验证新位置不会太靠近地球
            const testPos = new THREE.Vector3(newX + disturbX, newY + disturbY, newZ + disturbZ);
            if (testPos.length() > attack.earthRadius * 1.02) {
                positions[i3] = newX + disturbX;
                positions[i3 + 1] = newY + disturbY;
                positions[i3 + 2] = newZ + disturbZ;
            } else {
                // 如果太接近地球，向外推出
                testPos.normalize().multiplyScalar(attack.earthRadius * 1.02);
                positions[i3] = testPos.x;
                positions[i3 + 1] = testPos.y;
                positions[i3 + 2] = testPos.z;
            }
        }
        
        attack.particleFloodGeometry.attributes.position.needsUpdate = true;
        
        // 更新透明度
        attack.particleFlood.material.opacity = 0.85 * (1 - progress * 0.2);
    }
