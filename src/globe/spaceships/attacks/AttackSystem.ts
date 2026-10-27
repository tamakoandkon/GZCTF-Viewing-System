import * as THREE from 'three';

import type Spaceship from '../Spaceship';

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
                    this.updateLightningAttack(attack, delta);
                    break;
                case 2:
                    this.updateEnergyWaveAttack(attack, delta);
                    break;
                case 3:
                    this.updatePortalAttack(attack, delta);
                    break;
                case 4:
                    this.updateParticleFloodAttack(attack, delta);
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
        this.calculateAttackPath(attack);
        
        // 根据攻击类型创建不同的效果
        switch(attackType) {
            case 1:
                this.createLightningAttack(attack);
                break;
            case 2:
                this.createEnergyWaveAttack(attack);
                break;
            case 3:
                this.createPortalAttack(attack);
                break;
            case 4:
                this.createParticleFloodAttack(attack);
                break;
        }
        
        this.attacks.push(attack);
        
        // 设置飞船激活状态
        fromSpaceship.setActive(true);
        
        console.log(`Creating ${attackTypeNames[attackType-1]} attack from team ${fromTeamId} to ${attack.targetCountry}`);
        
        return attack;
    }


    /**
     * 计算攻击路径（避免穿过地球）
     */
    private calculateAttackPath(attack: AttackRecord): void {
        const startPos = attack.currentPosition.clone();
        const endPos = attack.toPosition.clone();
        const earthCenter = new THREE.Vector3(0, 0, 0);
        
        // 计算直线距离
        const directDistance = startPos.distanceTo(endPos);
        
        // 检查是否需要绕过地球
        const needsArcPath = this.needsArcPath(startPos, endPos, earthCenter, attack.earthRadius);
        
        if (needsArcPath) {
            // 创建弧形路径绕过地球
            attack.pathPoints = this.createArcPath(startPos, endPos, earthCenter, attack.earthRadius);
        } else {
            // 使用直线路径
            attack.pathPoints = [startPos, endPos];
        }
        
        console.log(`Attack path calculated: ${attack.pathPoints.length} points, arc: ${needsArcPath}`);
    }

    
    /**
     * 检查是否需要弧形路径
     */
    private needsArcPath(startPos: THREE.Vector3, endPos: THREE.Vector3, earthCenter: THREE.Vector3, earthRadius: number): boolean {
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

    
    /**
     * 创建弧形路径（改进版：确保不穿过地球）
     */
    private createArcPath(startPos: THREE.Vector3, endPos: THREE.Vector3, earthCenter: THREE.Vector3, earthRadius: number): THREE.Vector3[] {
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

    
    /**
     * 1. 闪电链攻击 - 折线效果，动态变化（改进：防止穿模）
     */
    private createLightningAttack(attack: AttackRecord): void {
        const pathPoints = attack.pathPoints;
        if (pathPoints.length < 2) return;
        
        const challengeColor = this.getChallengeColor(attack.challengeInfo.challengeCategory);
        
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
        
        this.add(lightningBeam);
        attack.objects.push(lightningBeam);
    }


    /**
     * 2. 能量波纹攻击 - 波纹扩散效果（改进：小巧精致）
     */
    private createEnergyWaveAttack(attack: AttackRecord): void {
        const pathPoints = attack.pathPoints;
        if (pathPoints.length < 2) return;
        
        const challengeColor = this.getChallengeColor(attack.challengeInfo.challengeCategory);
        
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
            this.add(ring);
            attack.objects.push(ring);
        }
        
        this.add(energyBall);
        attack.objects.push(energyBall);
        
        attack.energyBall = energyBall;
        attack.waveRings = waveRings;
        attack.wavePhase = 0;
    }


    /**
     * 3. 传送门攻击 - 传送门+能量束（改进：小巧精致）
     */
    private createPortalAttack(attack: AttackRecord): void {
        const challengeColor = this.getChallengeColor(attack.challengeInfo.challengeCategory);
        
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
        
        this.add(startPortal.group);
        this.add(endPortal.group);
        
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
        
        this.add(beam);
        attack.objects.push(beam);
        attack.portalBeam = beam;
    }


    /**
     * 4. 粒子洪流攻击 - 粒子流（改进：精致适量）
     */
    private createParticleFloodAttack(attack: AttackRecord): void {
        const pathPoints = attack.pathPoints;
        if (pathPoints.length < 2) return;
        
        const challengeColor = this.getChallengeColor(attack.challengeInfo.challengeCategory);
        
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
        
        this.add(particleSystem);
        attack.objects.push(particleSystem);
        
        attack.particleFlood = particleSystem;
        attack.particleFloodGeometry = particleGeometry;
        attack.floodStartPos = startPos.clone();
    }

    
    /**
     * 更新闪电链攻击（改进：防止穿模）
     */
    private updateLightningAttack(attack: AttackRecord, delta: number): void {
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


    /**
     * 更新能量波纹攻击（改进：小巧美观）
     */
    private updateEnergyWaveAttack(attack: AttackRecord, delta: number): void {
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


    /**
     * 更新传送门攻击
     */
    private updatePortalAttack(attack: AttackRecord, delta: number): void {
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


    /**
     * 更新粒子洪流攻击（改进：防止穿模）
     */
    private updateParticleFloodAttack(attack: AttackRecord, delta: number): void {
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


    /**
     * 根据挑战类别获取颜色
     */
    private getChallengeColor(category: string): string {
        const colorMap: Record<string, string> = {
            'Web': '#ff6b6b',
            'Crypto': '#4ecdc4',
            'Pwn': '#45b7d1',
            'Reverse': '#96ceb4',
            'Blockchain': '#feca57',
            'Forensics': '#ff9ff3',
            'Hardware': '#54a0ff',
            'Mobile': '#5f27cd',
            'PPC': '#00d2d3',
            'AI': '#ff6348',
            'Pentest': '#2ed573',
            'OSINT': '#ffa502',
            'Misc': '#ff7675'
        };
        return colorMap[category] || '#ffffff';
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
            const challengeColor = this.getChallengeColor(challengeCategory);

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
        const challengeColor = challengeCategory ? this.getChallengeColor(challengeCategory) : (isSuccess ? 0x00ff00 : 0xff0000);
        
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
