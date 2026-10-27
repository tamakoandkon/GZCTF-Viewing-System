import * as THREE from 'three';

import { getChallengeColor } from './palette';

export function createPortalAttack(parent: THREE.Object3D, attack: any): void {
        const challengeColor = getChallengeColor(attack.challengeInfo.challengeCategory);
        
        // 创建起点传送门（缩小尺寸）
        const createPortal = (position: THREE.Vector3, rotation = 0) => {
            const portalGroup = new THREE.Group();
            
            // 传送门环（缩小）
            const ringGeometry = new THREE.TorusGeometry(5, 0.8, 16, 32); // 从8/1减小到5/0.8
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(challengeColor),
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthTest: true,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            portalGroup.add(ring);
            
            // 传送门中心光晕（缩小）
            const glowGeometry = new THREE.CircleGeometry(4.5, 32); // 从7减小到4.5
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(challengeColor),
                transparent: true,
                opacity: 0.5, // 从0.4增加到0.5
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthTest: true,
                depthWrite: false
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            portalGroup.add(glow);
            
            // 传送门粒子效果
            const particleCount = 50;
            const particleGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            const baseColor = new THREE.Color(challengeColor);
            
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const radius = 3 + Math.random() * 5;
                positions[i * 3] = Math.cos(angle) * radius;
                positions[i * 3 + 1] = Math.sin(angle) * radius;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
                
                colors[i * 3] = baseColor.r;
                colors[i * 3 + 1] = baseColor.g;
                colors[i * 3 + 2] = baseColor.b;
            }
            
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            const particleMaterial = new THREE.PointsMaterial({
                size: 2,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });
            
            const particles = new THREE.Points(particleGeometry, particleMaterial);
            portalGroup.add(particles);
            
            portalGroup.position.copy(position);
            portalGroup.rotation.x = rotation;
            
            return { group: portalGroup, ring, glow, particles };
        };
        
        const startPortal = createPortal(attack.currentPosition, 0);
        const endPortal = createPortal(attack.toPosition, 0);
        
        // 初始时目标传送门不可见
        endPortal.group.visible = false;
        
        parent.add(startPortal.group);
        parent.add(endPortal.group);
        
        attack.objects.push(startPortal.group, endPortal.group);
        attack.startPortal = startPortal;
        attack.endPortal = endPortal;
        attack.portalPhase = 0;
        
        // 创建能量束（初始不可见，缩小半径）
        const beamGeometry = new THREE.CylinderGeometry(0.6, 0.6, 100, 8); // 从1减小到0.6
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(challengeColor),
            transparent: true,
            opacity: 0.75, // 从0.7增加到0.75
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.visible = false;
        beam.renderOrder = 10;
        
        parent.add(beam);
        attack.objects.push(beam);
        attack.portalBeam = beam;
    }

export function updatePortalAttack(attack: any, delta: number): void {
        if (!attack.startPortal || !attack.endPortal) return;
        
        const progress = attack.progress;
        
        // 阶段1: 打开起点传送门 (0-0.2)
        if (progress < 0.2) {
            const openProgress = progress / 0.2;
            attack.startPortal.ring.scale.setScalar(openProgress);
            attack.startPortal.glow.scale.setScalar(openProgress);
        }
        
        // 阶段2: 能量束穿越 (0.2-0.6)
        if (progress >= 0.2 && progress < 0.6) {
            attack.startPortal.ring.scale.setScalar(1);
            attack.startPortal.glow.scale.setScalar(1);
            
            // 显示能量束
            if (attack.portalBeam) {
                attack.portalBeam.visible = true;
                const beamProgress = (progress - 0.2) / 0.4;
                
                // 能量束从起点传送门射出
                const beamLength = attack.currentPosition.distanceTo(attack.toPosition) * beamProgress;
                attack.portalBeam.scale.set(1, beamLength / 100, 1);
                
                // 定位和旋转能量束
                const beamDir = new THREE.Vector3().subVectors(attack.toPosition, attack.currentPosition);
                const beamMid = new THREE.Vector3().addVectors(attack.currentPosition, beamDir.clone().multiplyScalar(beamProgress / 2));
                attack.portalBeam.position.copy(beamMid);
                attack.portalBeam.lookAt(attack.toPosition);
                attack.portalBeam.rotateX(Math.PI / 2);
            }
        }
        
        // 阶段3: 打开目标传送门 (0.6-0.8)
        if (progress >= 0.6 && progress < 0.8) {
            attack.endPortal.group.visible = true;
            const openProgress = (progress - 0.6) / 0.2;
            attack.endPortal.ring.scale.setScalar(openProgress);
            attack.endPortal.glow.scale.setScalar(openProgress);
        }
        
        // 阶段4: 能量从目标传送门射出 (0.8-1.0)
        if (progress >= 0.8) {
            attack.endPortal.ring.scale.setScalar(1);
            attack.endPortal.glow.scale.setScalar(1);
            if (attack.portalBeam) {
                attack.portalBeam.visible = true;
            }
        }
        
        // 传送门旋转动画
        attack.startPortal.ring.rotation.z += delta * 2;
        attack.endPortal.ring.rotation.z += delta * 2;
        
        // 传送门粒子旋转
        if (attack.startPortal.particles) {
            attack.startPortal.particles.rotation.z += delta;
        }
        if (attack.endPortal.particles && attack.endPortal.group.visible) {
            attack.endPortal.particles.rotation.z += delta;
        }
    }
