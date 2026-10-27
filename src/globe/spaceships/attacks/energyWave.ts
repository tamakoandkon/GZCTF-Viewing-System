import * as THREE from 'three';

import { getChallengeColor } from './palette';

export function createEnergyWaveAttack(parent: THREE.Object3D, attack: any): void {
        const pathPoints = attack.pathPoints;
        if (pathPoints.length < 2) return;
        
        const challengeColor = getChallengeColor(attack.challengeInfo.challengeCategory);
        
        // 创建小型能量球
        const energyBallGeometry = new THREE.SphereGeometry(2, 16, 16); // 从3减小到2
        const energyBallMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(challengeColor),
            transparent: true,
            opacity: 0.85, // 从0.8增加到0.85，更明显
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false
        });
        
        const energyBall = new THREE.Mesh(energyBallGeometry, energyBallMaterial);
        energyBall.position.copy(pathPoints[0]);
        energyBall.renderOrder = 10;
        
        // 创建小型波纹环
        const waveRings = [];
        for (let i = 0; i < 3; i++) {
            const ringGeometry = new THREE.RingGeometry(1.5, 2, 32); // 从2/2.5减小到1.5/2
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(challengeColor),
                transparent: true,
                opacity: 0.6 - i * 0.15,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthTest: true,
                depthWrite: false
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.renderOrder = 9;
            waveRings.push(ring);
            parent.add(ring);
            attack.objects.push(ring);
        }
        
        parent.add(energyBall);
        attack.objects.push(energyBall);
        
        attack.energyBall = energyBall;
        attack.waveRings = waveRings;
        attack.wavePhase = 0;
    }

export function updateEnergyWaveAttack(attack: any, delta: number): void {
        if (!attack.energyBall || !attack.waveRings) return;
        
        const progress = attack.progress;
        
        // 能量球沿路径移动
        const pathIndex = Math.floor(progress * (attack.pathPoints.length - 1));
        const nextIndex = Math.min(pathIndex + 1, attack.pathPoints.length - 1);
        const localProgress = (progress * (attack.pathPoints.length - 1)) - pathIndex;
        
        const currentPos = attack.pathPoints[pathIndex];
        const nextPos = attack.pathPoints[nextIndex];
        const ballPosition = new THREE.Vector3().lerpVectors(currentPos, nextPos, localProgress);
        
        attack.energyBall.position.copy(ballPosition);
        
        // 能量球旋转和脉动（减小脉动幅度）
        attack.energyBall.rotation.x += delta * 3;
        attack.energyBall.rotation.y += delta * 2;
        const pulseScale = 1 + Math.sin(progress * Math.PI * 10) * 0.15; // 从0.3减小到0.15
        attack.energyBall.scale.setScalar(pulseScale);
        
        // 更新波纹环（小范围扩散）
        attack.wavePhase = (attack.wavePhase || 0) + delta * 3;
        attack.waveRings.forEach((ring: THREE.Mesh, index: number) => {
            ring.position.copy(ballPosition);
            
            // 环面向运动方向
            const lookAtPos = new THREE.Vector3().copy(ballPosition).add(attack.direction);
            ring.lookAt(lookAtPos);
            
            // 波纹扩散动画（缩小扩散范围）
            const waveProgress = (attack.wavePhase + index * 0.5) % 1;
            const waveScale = 1 + waveProgress * 1.5; // 从3减小到1.5，大幅缩小
            ring.scale.setScalar(waveScale);
            (ring.material as THREE.Material).opacity = (0.6 - index * 0.2) * (1 - waveProgress);
        });
    }
