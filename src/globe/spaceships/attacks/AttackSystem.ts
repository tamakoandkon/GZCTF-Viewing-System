import * as THREE from 'three';

import type Spaceship from '../Spaceship';
import { createEnergyWaveAttack, updateEnergyWaveAttack } from './energyWave';
import { createLightningAttack, updateLightningAttack } from './lightning';
import { getChallengeColor } from './palette';
import { createParticleFloodAttack, updateParticleFloodAttack } from './particleFlood';
import { calculateAttackPath } from './path';
import { createPortalAttack, updatePortalAttack } from './portal';

export interface AttackChallengeInfo {
    challengeCategory?: string;
    challengeTitle?: string;
    isSuccess?: boolean;
}

export interface AttackHost {
    spaceships: Map<number, Spaceship>;
    earth: any;
    earthRadius: number;
    deviceCapabilities?: {
        isMobile?: boolean;
    };
}

interface DisposableRef {
    dispose?: () => void;
}

interface DisposableEntry {
    type: 'geometry' | 'material';
    ref: DisposableRef;
}

type AttackRecord = any;
type ExplosionRecord = any;

/**
 * 攻击与爆炸特效系统。
 *
 * 从 SpaceshipManager 中拆出：管理器只负责飞船/轨道/团队同步，攻击对象、
 * 路径计算、粒子与爆炸资源都由这里统一创建和释放。
 */
export default class AttackSystem extends THREE.Object3D {
    private readonly host: AttackHost;
    private attacks: AttackRecord[] = [];
    private explosions: ExplosionRecord[] = [];
    private explosionIdCounter = 0;
    private disposals: DisposableEntry[] = [];
    private readonly maxDisposalsPerFrame: number;

    constructor(host: AttackHost) {
        super();
        this.name = 'AttackSystem';
        this.host = host;
        this.maxDisposalsPerFrame = host.deviceCapabilities?.isMobile ? 2 : 4;
    }

    update(delta: number): void {
        this.updateAttacks(delta);
        this.updateExplosions(delta);
        this.processDeferredDisposals();
    }

    clearAll(): void {
        for (const attack of this.attacks) {
            if (attack.objects) {
                for (const obj of attack.objects) {
                    this.remove(obj);
                    for (const item of collectDisposables(obj)) this.disposals.push(item);
                }
            }
        }
        this.attacks = [];
        this.flushDeferredDisposals();
        this.clearAllExplosions();
    }

    dispose(): void {
        this.clearAll();
        this.removeFromParent();
    }

    private processDeferredDisposals(): void {
        if (this.disposals.length === 0) return;
        const count = Math.min(this.maxDisposalsPerFrame, this.disposals.length);
        for (let i = 0; i < count; i++) {
            const item = this.disposals.shift();
            if (item?.ref?.dispose) item.ref.dispose();
        }
    }

    private flushDeferredDisposals(): void {
        while (this.disposals.length > 0) {
            const item = this.disposals.shift();
            if (item?.ref?.dispose) item.ref.dispose();
        }
    }



    /**
     * 更新攻击动画 - 支持多种攻击类型
     */
    private updateAttacks(delta: number): void {
        this.attacks = this.attacks.filter(attack => {
            attack.progress += delta / (attack.duration / 1000); // 根据持续时间计算进度
            attack.delta = delta; // 传递delta给attack对象
            
            if (attack.progress >= 1) {
                // 攻击完成
                this.completeAttack(attack);
                return false;
            }
            
            // 根据攻击类型更新不同的效果
            switch(attack.attackType) {
                case 1:
                    updateLightningAttack(attack, delta);
                    break;
                case 2:
                    updateEnergyWaveAttack(attack, delta);
                    break;
                case 3:
                    updatePortalAttack(attack, delta);
                    break;
                case 4:
                    updateParticleFloodAttack(attack, delta);
                    break;
                default:
                    break;
            }
            
            return true;
        });
    }


    /**
     * 创建攻击动画（多样化攻击方式）
     */
    createAttack(fromTeamId: number, targetCountry: string | THREE.Vector3, challengeInfo: AttackChallengeInfo): AttackRecord | undefined {
        const fromSpaceship = this.host.spaceships.get(fromTeamId);
        if (!fromSpaceship) return;

        // 获取目标国家的3D坐标（优先使用几何中心）
        let toPosition: THREE.Vector3 | null = null;
        if (typeof targetCountry === 'string') {
            // 地球局部坐标的中心点，需要转换到攻击系统所在的世界坐标
            let center: { x: number; y: number; z: number } | null = null;
            if (this.host.earth?.getCountryGeometryCenter) {
                center = this.host.earth.getCountryGeometryCenter(targetCountry);
            }
            if (!center && this.host.earth?.getCountry3DPosition) {
                center = this.host.earth.getCountry3DPosition(targetCountry);
            }
            if (center) {
                toPosition = new THREE.Vector3(center.x, center.y, center.z);
                this.host.earth.localToWorld?.(toPosition);
                // 命中点抬到球壳外侧，避免爆炸环被地球表面遮住
                toPosition.setLength(this.host.earthRadius + 1.5);
            }
        } else {
            toPosition = targetCountry.clone();
        }

        if (!toPosition) {
            console.warn(`Invalid target position for attack from team ${fromTeamId} to ${targetCountry}`);
            return;
        }

        // 获取飞船的实际世界位置
        const spaceshipWorldPosition = new THREE.Vector3();
        fromSpaceship.getWorldPosition(spaceshipWorldPosition);

        // 随机选择攻击类型（1-4）
        const attackType = Math.floor(Math.random() * 4) + 1;
        const attackTypeNames = ['闪电链', '能量波纹', '传送门', '粒子洪流'];

        const attack = {
            id: `${fromTeamId}-${Date.now()}`,
            fromSpaceship,
            toPosition: new THREE.Vector3().copy(toPosition),
            challengeInfo,
            progress: 0,
            startTime: Date.now(),
            targetCountry: typeof targetCountry === 'string' ? targetCountry : null,
            attackType, // 攻击类型（1-4）
            // 通用属性
            currentPosition: spaceshipWorldPosition.clone(),
            direction: new THREE.Vector3().subVectors(toPosition, spaceshipWorldPosition).normalize(),
            duration: 2500, // 2.5秒完成攻击
            pathPoints: [],
            earthRadius: this.host.earthRadius,
            // 攻击对象容器
            objects: []
        };

        // 计算攻击路径（避免穿过地球）
        calculateAttackPath(attack);
        
        // 根据攻击类型创建不同的效果
        switch(attackType) {
            case 1:
                createLightningAttack(this, attack);
                break;
            case 2:
                createEnergyWaveAttack(this, attack);
                break;
            case 3:
                createPortalAttack(this, attack);
                break;
            case 4:
                createParticleFloodAttack(this, attack);
                break;
        }
        
        this.attacks.push(attack);
        
        // 设置飞船激活状态
        fromSpaceship.setActive(true);
        
        console.log(`Creating ${attackTypeNames[attackType-1]} attack from team ${fromTeamId} to ${attack.targetCountry}`);
        
        return attack;
    }


    /**
     * 完成攻击
     */
    private completeAttack(attack: AttackRecord): void {
        // 从场景中移除所有攻击对象（立即可见效果），GPU 资源推迟分批销毁
        if (attack.objects && attack.objects.length > 0) {
            attack.objects.forEach((obj: THREE.Object3D) => {
                this.remove(obj);
                // 递归收集所有可销毁资源（包括 Group 子节点，修复 portal 泄漏）
                const disposables = collectDisposables(obj);
                this.disposals.push(...disposables);
            });
        }

        // 飞船激化状态恢复（延迟到下一帧，避免与攻击清理挤在同一帧）
        if (attack.fromSpaceship) {
            const ship = attack.fromSpaceship;
            requestAnimationFrame(() => ship.setActive(false));
        }

        // 创建爆炸效果（保持即时，视觉反馈不应延迟）
        const challengeCategory = attack.challengeInfo?.challengeCategory;
        const isSuccess = attack.challengeInfo?.isSuccess || false;
        this.createCleanExplosionEffect(attack.toPosition, isSuccess, challengeCategory);

        // 触发国家高亮效果
        if (this.host.earth && attack.targetCountry && challengeCategory) {
            const targetCountry = attack.targetCountry;
            const challengeColor = getChallengeColor(challengeCategory);

            console.log(`Triggering country highlight for ${attack.targetCountry} with color ${challengeColor}`);

            setTimeout(() => {
                if (this.host.earth && this.host.earth.highlightCountry) {
                    this.host.earth.highlightCountry(targetCountry, challengeColor, 0.8);
                }
            }, 300);
        }
    }


    /**
     * 创建精致的爆炸效果（重构版：集中管理，确保清除）
     */
    private createCleanExplosionEffect(position: THREE.Vector3, isSuccess: boolean, challengeCategory: string | null = null): void {
        const challengeColor = challengeCategory ? getChallengeColor(challengeCategory) : (isSuccess ? 0x00ff00 : 0xff0000);
        
        // 1. 创建小型爆炸环（多层波纹）
        const rings = [];
        for (let i = 0; i < 3; i++) {
            const ringGeometry = new THREE.RingGeometry(0.5, 1, 24);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: challengeColor,
                transparent: true,
                opacity: 0.7 - i * 0.2,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthTest: true,
                depthWrite: false
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.copy(position);
            ring.lookAt(0, 0, 0); // 面向地球中心
            ring.renderOrder = 8 + i;
            rings.push(ring);
            this.add(ring);
        }
        
        // 2. 创建精致的粒子爆炸（少量粒子）
        const particleCount = 15;
        const particlePositions = new Float32Array(particleCount * 3);
        const particleVelocities = [];
        const particleColors = new Float32Array(particleCount * 3);
        
        const baseColor = new THREE.Color(challengeColor);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // 初始位置
            particlePositions[i3] = position.x;
            particlePositions[i3 + 1] = position.y;
            particlePositions[i3 + 2] = position.z;
            
            // 随机速度（向外扩散）
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 3 + Math.random() * 2;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * speed
            );
            particleVelocities.push(velocity);
            
            // 颜色
            const variation = 0.8 + Math.random() * 0.2;
            particleColors[i3] = baseColor.r * variation;
            particleColors[i3 + 1] = baseColor.g * variation;
            particleColors[i3 + 2] = baseColor.b * variation;
        }
        
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 1.5, // 小粒子
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false
        });
        
        const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        particleSystem.renderOrder = 9;
        this.add(particleSystem);
        
        // 添加到爆炸管理数组
        const explosion = {
            id: this.explosionIdCounter++,
            rings,
            particleSystem,
            particleGeometry,
            particleMaterial,
            particleVelocities,
            particleCount,
            startTime: Date.now(),
            duration: 800, // 0.8秒
            initialOpacities: rings.map(r => r.material.opacity)
        };
        
        this.explosions.push(explosion);
        
        console.log(`Created explosion effect #${explosion.id}, total explosions: ${this.explosions.length}`);
    }

    
    /**
     * 更新所有爆炸特效（集中管理）
     */
    private updateExplosions(delta: number): void {
        const currentTime = Date.now();
        
        this.explosions = this.explosions.filter(explosion => {
            const elapsed = currentTime - explosion.startTime;
            const progress = Math.min(1, elapsed / explosion.duration);
            
            if (progress >= 1) {
                // 清理爆炸资源
                explosion.rings.forEach((ring: THREE.Mesh) => {
                    this.remove(ring);
                    if (ring.geometry) ring.geometry.dispose();
                    if (ring.material) (ring.material as THREE.Material).dispose();
                });
                
                this.remove(explosion.particleSystem);
                if (explosion.particleGeometry) explosion.particleGeometry.dispose();
                if (explosion.particleMaterial) explosion.particleMaterial.dispose();
                
                console.log(`Explosion effect #${explosion.id} cleaned up`);
                return false; // 从数组中移除
            }
            
            // 更新波纹环（小范围扩散）
            explosion.rings.forEach((ring: THREE.Mesh, index: number) => {
                const delay = index * 0.15;
                const ringProgress = Math.max(0, (progress - delay) / (1 - delay));
                const scale = 1 + ringProgress * 4; // 扩散4倍
                ring.scale.setScalar(scale);
                (ring.material as THREE.Material).opacity = explosion.initialOpacities[index] * (1 - ringProgress);
            });
            
            // 更新粒子位置
            const positions = explosion.particleGeometry.attributes.position.array;
            for (let i = 0; i < explosion.particleCount; i++) {
                const i3 = i * 3;
                const velocity = explosion.particleVelocities[i];
                
                positions[i3] += velocity.x * delta;
                positions[i3 + 1] += velocity.y * delta;
                positions[i3 + 2] += velocity.z * delta;
            }
            explosion.particleGeometry.attributes.position.needsUpdate = true;
            
            // 粒子淡出
            explosion.particleSystem.material.opacity = 0.9 * (1 - progress);
            
            return true; // 保留在数组中
        });
    }


    /**
     * 清理所有爆炸特效
     */
    private clearAllExplosions(): void {
        this.explosions.forEach(explosion => {
            explosion.rings.forEach((ring: THREE.Mesh) => {
                this.remove(ring);
                if (ring.geometry) ring.geometry.dispose();
                if (ring.material) (ring.material as THREE.Material).dispose();
            });

            this.remove(explosion.particleSystem);
            if (explosion.particleGeometry) explosion.particleGeometry.dispose();
            if (explosion.particleMaterial) explosion.particleMaterial.dispose();
        });
        this.explosions = [];
    }
}

function collectDisposables(obj: any): DisposableEntry[] {
    const items: DisposableEntry[] = [];
    const stack = [obj];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        if (current.geometry) items.push({ type: 'geometry', ref: current.geometry });
        if (current.material) {
            if (Array.isArray(current.material)) {
                for (const material of current.material) items.push({ type: 'material', ref: material });
            } else {
                items.push({ type: 'material', ref: current.material });
            }
        }
        if (current.children?.length) stack.push(...current.children);
    }
    return items;
}
