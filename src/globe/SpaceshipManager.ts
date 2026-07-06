// @ts-nocheck
import * as THREE from 'three';
import AttackSystem from "./systems/AttackSystem"
import Spaceship from './Spaceship';

export default class SpaceshipManager extends THREE.Object3D {
    /**
     * 3D飞船管理器
     * @param {{
     *   earthRadius?: number,
     *   maxShips?: number,
     *   deviceCapabilities?: any
     * }} config 
     */
    constructor(config = {}) {
        super();
        
        const {
            earthRadius = 100,
            maxShips = 20,
            deviceCapabilities = {
                isMobile: false,
                renderQuality: 1
            }
        } = config;

        this.name = 'SpaceshipManager';
        this.earthRadius = earthRadius;
        this.maxShips = maxShips;
        this.deviceCapabilities = deviceCapabilities;
        
        // 飞船存储
        this.spaceships = new Map();
        // 修复：移除轨道组，避免坐标体系混淆
        // this.spaceshipGroups = new Map(); // 按轨道分组
        
        // 攻击动画
        this.attacks = [];
        
        // 爆炸特效集中管理
        this.explosions = [];
        this.explosionIdCounter = 0;

        // 延迟 GPU 资源销毁队列（避免单帧 dispose 风暴）
        this._pendingDisposals = [];
        this._maxDisposalsPerFrame = deviceCapabilities.isMobile ? 2 : 4;
        
        // 性能优化
        this.updateIndex = 0;
        this.maxUpdatesPerFrame = deviceCapabilities.isMobile ? 3 : 8; // 根据设备调整更新频率
        
        // 深度排序
        this.depthSortingEnabled = true;
        
        // 相机引用（用于深度计算）
        this.camera = null;
        this.earth = null;
        this.forcedUpdateShipId = null;
        
        // 修复：初始化深度排序相关属性，避免undefined错误
        this.lastCameraPosition = null;
        this.lastDepthSortTime = 0;
        this.attackSystem = new AttackSystem(this)
    }

    /**
     * 设置相机和地球引用
     */
    setReferences(camera, earth) {
        this.camera = camera;
        this.earth = earth;
    }

    setForcedUpdateShipId(teamId) {
        this.forcedUpdateShipId = teamId ?? null;
    }

    /**
     * 创建飞船
     */
    createSpaceship(teamInfo, index) {
        const spaceshipId = teamInfo.id;
        
        // 如果飞船已存在，更新信息并返回
        if (this.spaceships.has(spaceshipId)) {
            const existingSpaceship = this.spaceships.get(spaceshipId);
            existingSpaceship.updateTeamInfo(teamInfo);
            return existingSpaceship;
        }

        // 计算轨道参数
        const orbitConfig = this.calculateOrbitConfig(teamInfo, index);
        
        // 创建飞船
        const spaceship = new Spaceship({
            teamId: teamInfo.id,
            teamName: teamInfo.name,
            rank: teamInfo.rank,
            score: teamInfo.score,
            colorHue: orbitConfig.colorHue,
            size: orbitConfig.size,
            orbitRadius: orbitConfig.orbitRadius,
            orbitSpeed: orbitConfig.orbitSpeed,
            orbitHeight: orbitConfig.orbitHeight,
            orbitOffset: orbitConfig.orbitOffset
        });

        // 设置初始位置在地球表面（等待发射）- 修复：从地球表面开始
        const earthRadius = this.earthRadius;
        const surfaceRadius = earthRadius * 1.02; // 地球表面稍微向外一点
        spaceship.position.set(
            Math.cos(orbitConfig.orbitOffset) * surfaceRadius, // 地球表面
            orbitConfig.orbitHeight, // 保持轨道高度
            Math.sin(orbitConfig.orbitOffset) * surfaceRadius
        );

        // 修复：飞船直接添加到SpaceshipManager，避免坐标体系混淆
        this.add(spaceship);
        this.spaceships.set(spaceshipId, spaceship);

        // 修复：移除轨道组管理，飞船位置计算基于世界坐标
        // const orbitGroup = this.getOrbitGroup(orbitConfig.orbitRadius);
        // orbitGroup.add(spaceship);

        console.log(`Created spaceship for team ${teamInfo.name} (ID: ${teamInfo.id})`);
        return spaceship;
    }

    /**
     * 计算轨道配置 - 修复版本，确保轨道参数唯一
     * @deprecated 使用 getRankPositionConfig 替代，基于排名而非index
     */
    calculateOrbitConfig(teamInfo, index) {
        const radiusScale = this.deviceCapabilities.isMobile ? 0.8 : 1;
        const earthRadius = this.earthRadius;
        const orbitMultiplier = 1.4;

        let orbitRadius, orbitHeight, orbitSpeed, colorHue, size;

        // 修复：使用index确保每个飞船有唯一的轨道配置
        if (index < 3) {
            // 低轨道 - 前3个飞船
            orbitRadius = (earthRadius + 40) * orbitMultiplier * radiusScale;
            orbitHeight = 20 * radiusScale;
            orbitSpeed = -0.05; // 修复：负值=逆时针（与地球同向），会乘以delta
            colorHue = 50 + index * 30; // 确保颜色不同
            size = index === 0 ? 1.8 : index === 1 ? 1.7 : 1.6;
        } else if (index < 9) {
            // 中轨道 - 第4-9个飞船
            orbitRadius = (earthRadius + 70) * orbitMultiplier * radiusScale;
            orbitHeight = 0;
            orbitSpeed = -0.04; // 修复：负值=逆时针，中轨道稍慢
            colorHue = 220 + (index - 3) * 25; // 增加间隔
            size = 1.5;
        } else {
            // 高轨道 - 第10个以后的飞船
            orbitRadius = (earthRadius + 100) * orbitMultiplier * radiusScale;
            orbitHeight = -20 * radiusScale;
            orbitSpeed = -0.03; // 修复：负值=逆时针，高轨道最慢
            colorHue = 100 + (index - 9) * 20; // 增加间隔
            size = 1.4;
        }

        // 修复：使用index计算角度，确保唯一性
        const teamsInOrbit = index < 3 ? 3 : index < 9 ? 6 : Math.max(1, this.maxShips - 9);
        const angle = (index % teamsInOrbit / teamsInOrbit) * Math.PI * 2;
        const orbitOffset = angle;

        return {
            orbitRadius,
            orbitSpeed,
            orbitHeight,
            colorHue,
            orbitOffset,
            size
        };
    }

    /**
     * 根据排名计算固定位置配置 - 新方法，每个排名对应唯一位置
     * @param {number} rank - 排名（1-20）
     * @returns {Object} 轨道配置
     */
    getRankPositionConfig(rank) {
        const radiusScale = this.deviceCapabilities.isMobile ? 0.8 : 1;
        const earthRadius = this.earthRadius;
        const orbitMultiplier = 1.4;

        // 排名从1开始，转换为index（0开始）
        const index = rank - 1;
        
        let orbitRadius, orbitHeight, orbitSpeed, colorHue, size, orbitOffset;

        // 根据排名分配到不同轨道层
        if (rank <= 3) {
            // 低轨道 - 前3名，每人120度间隔
            orbitRadius = (earthRadius + 40) * orbitMultiplier * radiusScale;
            orbitHeight = 20 * radiusScale;
            orbitSpeed = -0.05; // 修复：负值=逆时针（与地球同向），会乘以delta
            colorHue = 50 + index * 30;
            size = rank === 1 ? 1.8 : rank === 2 ? 1.7 : 1.6;
            orbitOffset = (index / 3) * Math.PI * 2; // 0°, 120°, 240°
            
        } else if (rank <= 9) {
            // 中轨道 - 第4-9名，每人60度间隔
            orbitRadius = (earthRadius + 70) * orbitMultiplier * radiusScale;
            orbitHeight = 0;
            orbitSpeed = -0.04; // 修复：负值=逆时针，中轨道稍慢
            colorHue = 220 + (index - 3) * 25;
            size = 1.5;
            orbitOffset = ((index - 3) / 6) * Math.PI * 2; // 0°, 60°, 120°, 180°, 240°, 300°
            
        } else {
            // 高轨道 - 第10-20名，根据总数平均分配
            orbitRadius = (earthRadius + 100) * orbitMultiplier * radiusScale;
            orbitHeight = -20 * radiusScale;
            orbitSpeed = -0.03; // 修复：负值=逆时针，高轨道最慢
            colorHue = 100 + (index - 9) * 20;
            size = 1.4;
            const maxHighOrbitShips = Math.max(1, this.maxShips - 9);
            orbitOffset = ((index - 9) / maxHighOrbitShips) * Math.PI * 2;
        }

        return {
            orbitRadius,
            orbitSpeed,
            orbitHeight,
            colorHue,
            orbitOffset,
            size,
            rank // 存储排名信息
        };
    }
    

    /**
     * 在指定排名位置创建飞船 - 基于排名的固定位置系统
     */
    createSpaceshipAtRank(teamInfo) {
        const spaceshipId = teamInfo.id;
        
        // 如果飞船已存在，更新信息并返回
        if (this.spaceships.has(spaceshipId)) {
            const existingSpaceship = this.spaceships.get(spaceshipId);
            existingSpaceship.updateTeamInfo(teamInfo);
            return existingSpaceship;
        }

        // 根据排名获取固定位置配置
        const positionConfig = this.getRankPositionConfig(teamInfo.rank);
        
        // 创建飞船
        const spaceship = new Spaceship({
            teamId: teamInfo.id,
            teamName: teamInfo.name,
            rank: teamInfo.rank,
            score: teamInfo.score,
            colorHue: positionConfig.colorHue,
            size: positionConfig.size,
            orbitRadius: positionConfig.orbitRadius,
            orbitSpeed: positionConfig.orbitSpeed,
            orbitHeight: positionConfig.orbitHeight,
            orbitOffset: positionConfig.orbitOffset
        });

        // 设置初始位置在地球内部（等待发射）
        const earthRadius = this.earthRadius;
        spaceship.position.set(
            Math.cos(positionConfig.orbitOffset) * earthRadius * 0.8,
            positionConfig.orbitHeight - 50,
            Math.sin(positionConfig.orbitOffset) * earthRadius * 0.8
        );

        this.add(spaceship);
        this.spaceships.set(spaceshipId, spaceship);

        console.log(`Created spaceship for team ${teamInfo.name} at rank ${teamInfo.rank} position (offset: ${positionConfig.orbitOffset})`);
        return spaceship;
    }

    /**
     * 获取或创建轨道组 - 已弃用，飞船直接添加到SpaceshipManager
     * @deprecated 轨道组已移除，避免坐标体系混淆
     */
    getOrbitGroup(orbitRadius) {
        console.warn('getOrbitGroup is deprecated. Spaceships are now added directly to SpaceshipManager.');
        // 返回SpaceshipManager本身，作为兼容性处理
        return this;
    }

    /**
     * 更新所有飞船
     */
    update(delta) {
        // 更新所有飞船位置，这计算量很小，避免分帧导致的抖动
        const spaceshipArray = Array.from(this.spaceships.values());
        
        for (let i = 0; i < spaceshipArray.length; i++) {
            const spaceship = spaceshipArray[i];
            if (spaceship && spaceship.modelLoaded) {
                spaceship.updatePosition(delta);
            }
        }

        // 更新攻击动画
        this.updateAttacks(delta);
        
        // 更新爆炸特效
        this.updateExplosions(delta);

        // 深度排序 - 基于相机移动距离触发
        if (this.depthSortingEnabled && this.camera) {
            this.updateDepthSorting(delta);
        }

        // 延迟 GPU 资源销毁（每帧处理少量，避免 dispose 风暴阻塞主线程）
        this._processDeferredDisposals();
    }

    /**
     * 更新攻击动画 - 支持多种攻击类型
     */
    updateAttacks(delta) {
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
            this.updateCleanAttack(attack);
            }
            
            return true;
        });
    }

    /**
     * 创建攻击动画（多样化攻击方式）
     */
    createAttack(fromTeamId, targetCountry, challengeInfo) {
        const fromSpaceship = this.spaceships.get(fromTeamId);
        if (!fromSpaceship) return;

        // 获取目标国家的3D坐标（优先使用几何中心）
        let toPosition;
        if (typeof targetCountry === 'string') {
            // 如果是国家名称，优先通过几何中心获取坐标
            if (this.earth && this.earth.getCountryGeometryCenter) {
                toPosition = this.earth.getCountryGeometryCenter(targetCountry);
                console.log(`Using geometry center for ${targetCountry}:`, toPosition);
            }
            
            // 如果几何中心不存在，使用预定义坐标作为备选
            if (!toPosition && this.earth && this.earth.getCountry3DPosition) {
                toPosition = this.earth.getCountry3DPosition(targetCountry);
                console.log(`Using predefined position for ${targetCountry}:`, toPosition);
            }
        } else {
            // 如果是坐标对象
            toPosition = targetCountry;
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
            earthRadius: this.earthRadius,
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
    calculateAttackPath(attack) {
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
    needsArcPath(startPos, endPos, earthCenter, earthRadius) {
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
    createArcPath(startPos, endPos, earthCenter, earthRadius) {
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
    createLightningAttack(attack) {
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
    createEnergyWaveAttack(attack) {
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
    createPortalAttack(attack) {
        const challengeColor = this.getChallengeColor(attack.challengeInfo.challengeCategory);
        
        // 创建起点传送门（缩小尺寸）
        const createPortal = (position, rotation = 0) => {
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
    createParticleFloodAttack(attack) {
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
     * 创建简洁的攻击光束（旧方法，保留作为参考）
     */
    createCleanAttackBeam(attack) {
        const pathPoints = attack.pathPoints;
        if (pathPoints.length < 2) return;
        
        // 创建光束几何体
        attack.attackGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        
        // 获取挑战颜色
        const challengeColor = this.getChallengeColor(attack.challengeInfo.challengeCategory);
        const baseColor = new THREE.Color(challengeColor);
        
        // 创建简洁的光束材质
        attack.attackMaterial = new THREE.LineBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        
        // 创建光束
        attack.attackBeam = new THREE.Line(attack.attackGeometry, attack.attackMaterial);
        attack.attackBeam.renderOrder = 10;
        
        // 添加到场景
        this.add(attack.attackBeam);
        
        // 创建光束粒子效果
        this.createBeamParticles(attack);
    }
    
    /**
     * 创建光束粒子效果
     */
    createBeamParticles(attack) {
        const particleCount = 30;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        const challengeColor = this.getChallengeColor(attack.challengeInfo.challengeCategory);
        const baseColor = new THREE.Color(challengeColor);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const progress = i / particleCount;
            
            // 沿路径分布粒子
            const pathIndex = Math.floor(progress * (attack.pathPoints.length - 1));
            const point = attack.pathPoints[pathIndex];
            
            positions[i3] = point.x;
            positions[i3 + 1] = point.y;
            positions[i3 + 2] = point.z;
            
            // 设置粒子颜色
            colors[i3] = baseColor.r;
            colors[i3 + 1] = baseColor.g;
            colors[i3 + 2] = baseColor.b;
            
            sizes[i] = Math.random() * 1.5 + 0.5;
        }
        
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        attack.particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        attack.particleGeometry = particleGeometry;
        attack.particleMaterial = particleMaterial;
        attack.particleSystem.renderOrder = 9;
        
        this.add(attack.particleSystem);
    }

    /**
     * 创建光球攻击（已弃用）
     */
    createLightBallAttack(attack) {
        // 计算光球移动方向
        const direction = new THREE.Vector3().subVectors(attack.toPosition, attack.lightBallPosition).normalize();
        attack.lightBallVelocity.copy(direction).multiplyScalar(attack.lightBallSpeed);
        
        // 创建光球几何体
        const lightBallGeometry = new THREE.SphereGeometry(attack.lightBallSize, 16, 16);
        
        // 创建光球材质
        const baseColor = attack.challengeInfo.isSuccess ? new THREE.Color(0x00ff00) : new THREE.Color(0xff0000);
        attack.lightBallMaterial = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        // 创建光球网格
        attack.lightBall = new THREE.Mesh(lightBallGeometry, attack.lightBallMaterial);
        attack.lightBall.position.copy(attack.lightBallPosition);
        attack.lightBall.renderOrder = 10;
        
        // 创建光球光晕
        const glowGeometry = new THREE.SphereGeometry(attack.lightBallSize * 2, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        
        attack.lightBallGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        attack.lightBallGlow.position.copy(attack.lightBallPosition);
        attack.lightBallGlow.renderOrder = 9;
        
        // 添加到场景
        this.add(attack.lightBall);
        this.add(attack.lightBallGlow);
    }
    
    /**
     * 更新闪电链攻击（改进：防止穿模）
     */
    updateLightningAttack(attack, delta) {
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
    updateEnergyWaveAttack(attack, delta) {
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
        attack.waveRings.forEach((ring, index) => {
            ring.position.copy(ballPosition);
            
            // 环面向运动方向
            const lookAtPos = new THREE.Vector3().copy(ballPosition).add(attack.direction);
            ring.lookAt(lookAtPos);
            
            // 波纹扩散动画（缩小扩散范围）
            const waveProgress = (attack.wavePhase + index * 0.5) % 1;
            const waveScale = 1 + waveProgress * 1.5; // 从3减小到1.5，大幅缩小
            ring.scale.setScalar(waveScale);
            ring.material.opacity = (0.6 - index * 0.2) * (1 - waveProgress);
        });
    }

    /**
     * 更新传送门攻击
     */
    updatePortalAttack(attack, delta) {
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
    updateParticleFloodAttack(attack, delta) {
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
     * 更新简洁攻击效果（旧方法，保留兼容）
     */
    updateCleanAttack(attack) {
        if (!attack.attackBeam || !attack.particleSystem) return;
        
        const progress = attack.progress;
        
        // 更新光束透明度
        if (attack.attackMaterial) {
            attack.attackMaterial.opacity = 0.8 * (1 - progress * 0.3);
        }
        
        // 更新粒子效果
        if (attack.particleMaterial) {
            attack.particleMaterial.opacity = 0.6 * (1 - progress * 0.5);
        }
        
        // 创建光束流动效果
        this.updateBeamFlow(attack, progress);
    }
    
    /**
     * 更新光束流动效果
     */
    updateBeamFlow(attack, progress) {
        if (!attack.particleSystem || !attack.pathPoints) return;
        
        const positions = attack.particleGeometry.attributes.position.array;
        const particleCount = positions.length / 3;
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // 计算粒子在路径上的位置
            const particleProgress = (i / particleCount + progress * 0.3) % 1;
            const pathIndex = Math.floor(particleProgress * (attack.pathPoints.length - 1));
            const nextIndex = Math.min(pathIndex + 1, attack.pathPoints.length - 1);
            
            // 线性插值
            const t = (particleProgress * (attack.pathPoints.length - 1)) - pathIndex;
            const currentPoint = attack.pathPoints[pathIndex];
            const nextPoint = attack.pathPoints[nextIndex];
            
            positions[i3] = currentPoint.x + (nextPoint.x - currentPoint.x) * t;
            positions[i3 + 1] = currentPoint.y + (nextPoint.y - currentPoint.y) * t;
            positions[i3 + 2] = currentPoint.z + (nextPoint.z - currentPoint.z) * t;
        }
        
        attack.particleGeometry.attributes.position.needsUpdate = true;
    }

    /**
     * 更新光球攻击（已弃用）
     */
    updateLightBallAttack(attack) {
        if (!attack.lightBall || !attack.lightBallGlow) return;
        
        // 获取delta时间用于时间归一化
        const delta = attack.delta || 16; // 默认16ms (60fps)
        const deltaSeconds = delta / 1000;
        
        // 计算光球到目标的距离
        const distanceToTarget = attack.lightBallPosition.distanceTo(attack.toPosition);
        
        // 动态调整光球速度（距离目标越近，速度越快）
        const speedMultiplier = Math.max(0.5, 1 + (1 - distanceToTarget / 200) * 2);
        
        // 更新光球位置
        attack.lightBallPosition.add(
            attack.lightBallVelocity.clone().multiplyScalar(deltaSeconds * speedMultiplier)
        );
        
        // 更新光球和光晕位置
        attack.lightBall.position.copy(attack.lightBallPosition);
        attack.lightBallGlow.position.copy(attack.lightBallPosition);
        
        // 动态光球大小（飞行过程中逐渐增大）
        const sizeMultiplier = 1 + attack.progress * 0.5;
        attack.lightBall.scale.setScalar(sizeMultiplier);
        attack.lightBallGlow.scale.setScalar(sizeMultiplier);
        
        // 动态透明度效果
        const intensity = Math.sin(attack.progress * Math.PI) * 0.4 + 0.6;
        attack.lightBallMaterial.opacity = intensity;
        attack.lightBallGlow.material.opacity = intensity * 0.3;
        
        // 动态颜色效果（成功/失败）
        const baseColor = attack.challengeInfo.isSuccess ? 0x00ff00 : 0xff0000;
        const colorVariation = Math.sin(attack.progress * Math.PI * 4) * 0.3 + 0.7;
        attack.lightBallMaterial.color.setHex(baseColor).multiplyScalar(colorVariation);
        attack.lightBallGlow.material.color.setHex(baseColor).multiplyScalar(colorVariation);
        
        // 光球旋转效果
        attack.lightBall.rotation.x += deltaSeconds * 2;
        attack.lightBall.rotation.y += deltaSeconds * 3;
        attack.lightBall.rotation.z += deltaSeconds * 1.5;
        
        // 检查光球是否到达目标
        if (distanceToTarget < 8) {
            // 光球到达目标，完成攻击
            attack.progress = 1;
        }
    }

    /**
     * 根据挑战类别获取颜色
     */
    getChallengeColor(category) {
        const colorMap = {
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
     * 创建动态攻击光束（导弹效果） - 改进版：更真实的导弹动画
     */
    createAttackBeam(attack) {
        // 创建导弹轨迹点数组
        const missilePoints = 30; // 增加轨迹点数，让轨迹更平滑
        const positions = new Float32Array(missilePoints * 3);
        
        // 初始化所有点为起始位置
        for (let i = 0; i < missilePoints; i++) {
            const i3 = i * 3;
            positions[i3] = attack.fromSpaceship.position.x;
            positions[i3 + 1] = attack.fromSpaceship.position.y;
            positions[i3 + 2] = attack.fromSpaceship.position.z;
        }

        attack.beamGeometry = new THREE.BufferGeometry();
        attack.beamGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        attack.beamMaterial = new THREE.LineBasicMaterial({
            color: attack.challengeInfo.isSuccess ? 0x00ff00 : 0xff0000,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            linewidth: 3
        });

        attack.beamMesh = new THREE.Line(attack.beamGeometry, attack.beamMaterial);
        attack.beamMesh.renderOrder = 10; // 确保光束在最前面
        
        // 添加导弹属性 - 改进版
        attack.missilePoints = missilePoints;
        attack.currentMissilePosition = 0;
        attack.missileSpeed = 0.8; // 减慢导弹移动速度，让动画更明显
        attack.missileTrail = []; // 导弹尾迹
        attack.missileDirection = new THREE.Vector3().subVectors(attack.toPosition, attack.fromSpaceship.position).normalize();
        attack.missilePosition = attack.fromSpaceship.position.clone();
        attack.missileRotation = 0;
        attack.missileWobble = 0;
        
        // 添加导弹物理属性
        attack.missileVelocity = attack.missileDirection.clone().multiplyScalar(attack.missileSpeed);
        attack.missileAcceleration = new THREE.Vector3(0, 0, 0);
        attack.missileDamping = 0.98; // 阻力系数
        attack.missileGravity = 0.001; // 重力效果
        attack.missileNoise = Math.random() * 0.1; // 随机噪声
        attack.missilePhase = Math.random() * Math.PI * 2; // 随机相位
        
        this.add(attack.beamMesh);
    }

    /**
     * 更新动态攻击光束（导弹效果） - 改进版：更真实的导弹物理动画
     */
    updateAttackBeam(attack) {
        if (!attack.beamMesh) return;

        const positions = attack.beamGeometry.attributes.position.array;
        const missilePoints = attack.missilePoints;
        
        // 获取delta时间用于时间归一化
        const delta = attack.delta || 16; // 默认16ms (60fps)
        const deltaSeconds = delta / 1000; // 转换为秒
        
        // 计算导弹到目标的距离
        const distanceToTarget = attack.missilePosition.distanceTo(attack.toPosition);
        
        // 动态调整导弹速度（距离目标越近，速度越快）
        const speedMultiplier = Math.max(0.5, 1 + (1 - distanceToTarget / 200) * 2);
        
        // 添加重力效果
        attack.missileVelocity.y -= attack.missileGravity * deltaSeconds;
        
        // 添加阻力
        attack.missileVelocity.multiplyScalar(Math.pow(attack.missileDamping, deltaSeconds));
        
        // 添加随机摆动（模拟导弹制导系统的微调）
        attack.missileWobble += deltaSeconds * 3;
        const wobbleIntensity = Math.min(1, distanceToTarget / 100); // 距离越近摆动越小
        const wobbleX = Math.sin(attack.missileWobble + attack.missilePhase) * 3 * wobbleIntensity;
        const wobbleY = Math.cos(attack.missileWobble * 0.8 + attack.missilePhase) * 2 * wobbleIntensity;
        const wobbleZ = Math.sin(attack.missileWobble * 1.2 + attack.missilePhase) * 2 * wobbleIntensity;
        
        // 添加噪声效果
        const noiseX = (Math.random() - 0.5) * attack.missileNoise;
        const noiseY = (Math.random() - 0.5) * attack.missileNoise;
        const noiseZ = (Math.random() - 0.5) * attack.missileNoise;
        
        // 更新导弹位置
        attack.missilePosition.add(attack.missileVelocity.clone().multiplyScalar(deltaSeconds * speedMultiplier));
        
        // 计算导弹当前位置（带摆动和噪声）
        const currentPos = attack.missilePosition.clone();
        currentPos.x += wobbleX + noiseX;
        currentPos.y += wobbleY + noiseY;
        currentPos.z += wobbleZ + noiseZ;
        
        // 更新导弹尾迹
        attack.missileTrail.unshift(currentPos.clone());
        if (attack.missileTrail.length > missilePoints) {
            attack.missileTrail.pop();
        }
        
        // 更新轨迹点位置
        for (let i = 0; i < missilePoints; i++) {
            const i3 = i * 3;
            if (i < attack.missileTrail.length) {
                const trailPos = attack.missileTrail[i];
                positions[i3] = trailPos.x;
                positions[i3 + 1] = trailPos.y;
                positions[i3 + 2] = trailPos.z;
            } else {
                // 如果尾迹不够长，使用起始位置
                positions[i3] = attack.fromSpaceship.position.x;
                positions[i3 + 1] = attack.fromSpaceship.position.y;
                positions[i3 + 2] = attack.fromSpaceship.position.z;
            }
        }
        
        // 动态透明度效果（尾迹渐变）
        const intensity = Math.sin(attack.progress * Math.PI) * 0.6 + 0.4;
        attack.beamMaterial.opacity = intensity;
        
        // 动态颜色效果（成功/失败）
        const baseColor = attack.challengeInfo.isSuccess ? 0x00ff00 : 0xff0000;
        const colorVariation = Math.sin(attack.progress * Math.PI * 4) * 0.3 + 0.7;
        attack.beamMaterial.color.setHex(baseColor).multiplyScalar(colorVariation);
        
        attack.beamGeometry.attributes.position.needsUpdate = true;
        
        // 检查导弹是否到达目标
        if (distanceToTarget < 8) {
            // 导弹到达目标，完成攻击
            attack.progress = 1;
        }
    }

    /**
     * 完成攻击
     */
    completeAttack(attack) {
        // 从场景中移除所有攻击对象（立即可见效果），GPU 资源推迟分批销毁
        if (attack.objects && attack.objects.length > 0) {
            attack.objects.forEach(obj => {
                this.remove(obj);
                // 递归收集所有可销毁资源（包括 Group 子节点，修复 portal 泄漏）
                const disposables = this._collectDisposables(obj);
                this._pendingDisposals.push(...disposables);
            });
        }

        // 清理旧方法的攻击对象（同样延迟销毁）
        if (attack.attackBeam) {
            this.remove(attack.attackBeam);
            if (attack.attackGeometry) this._pendingDisposals.push({ type: 'geometry', ref: attack.attackGeometry });
            if (attack.attackMaterial) this._pendingDisposals.push({ type: 'material', ref: attack.attackMaterial });
        }

        if (attack.particleSystem) {
            this.remove(attack.particleSystem);
            if (attack.particleGeometry) this._pendingDisposals.push({ type: 'geometry', ref: attack.particleGeometry });
            if (attack.particleMaterial) this._pendingDisposals.push({ type: 'material', ref: attack.particleMaterial });
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
        if (this.earth && attack.targetCountry && challengeCategory) {
            const targetCountry = attack.targetCountry;
            const challengeColor = this.getChallengeColor(challengeCategory);

            console.log(`Triggering country highlight for ${attack.targetCountry} with color ${challengeColor}`);

            setTimeout(() => {
                if (this.earth && this.earth.highlightCountry) {
                    this.earth.highlightCountry(targetCountry, challengeColor, 0.8);
                }
            }, 300);
        }
    }

    /**
     * 创建精致的爆炸效果（重构版：集中管理，确保清除）
     */
    createCleanExplosionEffect(position, isSuccess, challengeCategory = null) {
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
    updateExplosions(delta) {
        const currentTime = Date.now();
        
        this.explosions = this.explosions.filter(explosion => {
            const elapsed = currentTime - explosion.startTime;
            const progress = Math.min(1, elapsed / explosion.duration);
            
            if (progress >= 1) {
                // 清理爆炸资源
                explosion.rings.forEach(ring => {
                    this.remove(ring);
                    if (ring.geometry) ring.geometry.dispose();
                    if (ring.material) ring.material.dispose();
                });
                
                this.remove(explosion.particleSystem);
                if (explosion.particleGeometry) explosion.particleGeometry.dispose();
                if (explosion.particleMaterial) explosion.particleMaterial.dispose();
                
                console.log(`Explosion effect #${explosion.id} cleaned up`);
                return false; // 从数组中移除
            }
            
            // 更新波纹环（小范围扩散）
            explosion.rings.forEach((ring, index) => {
                const delay = index * 0.15;
                const ringProgress = Math.max(0, (progress - delay) / (1 - delay));
                const scale = 1 + ringProgress * 4; // 扩散4倍
                ring.scale.setScalar(scale);
                ring.material.opacity = explosion.initialOpacities[index] * (1 - ringProgress);
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
     * 创建爆炸效果 - 光球爆炸版本（已弃用）
     */
    createExplosionEffect(position, isSuccess) {
        const particleCount = 50; // 增加粒子数量，让爆炸更壮观
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const velocities = new Float32Array(particleCount * 3);
        
        const baseColor = isSuccess ? new THREE.Color(0x00ff00) : new THREE.Color(0xff0000);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // 初始位置在爆炸中心
            positions[i3] = position.x;
            positions[i3 + 1] = position.y;
            positions[i3 + 2] = position.z;
            
            // 随机爆炸方向
            const angle = (i / particleCount) * Math.PI * 2;
            const elevation = (Math.random() - 0.5) * Math.PI;
            const speed = Math.random() * 15 + 5;
            
            velocities[i3] = Math.cos(angle) * Math.cos(elevation) * speed;
            velocities[i3 + 1] = Math.sin(elevation) * speed;
            velocities[i3 + 2] = Math.sin(angle) * Math.cos(elevation) * speed;
            
            // 颜色变化
            const colorVariation = 0.7 + Math.random() * 0.3;
            colors[i3] = baseColor.r * colorVariation;
            colors[i3 + 1] = baseColor.g * colorVariation;
            colors[i3 + 2] = baseColor.b * colorVariation;
            
            sizes[i] = Math.random() * 3 + 1;
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        
        const material = new THREE.PointsMaterial({
            size: 3,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        
        const explosion = new THREE.Points(geometry, material);
        explosion.renderOrder = 5;
        this.add(explosion);
        
        // 创建爆炸冲击波
        this.createShockwave(position, isSuccess);
        
        // 使用requestAnimationFrame实现爆炸动画
        const startTime = Date.now();
        const duration = 3000; // 3秒爆炸效果
        
        const animateExplosion = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                // 动画完成，移除爆炸效果
                this.remove(explosion);
                geometry.dispose();
                material.dispose();
                return;
            }
            
            // 更新粒子位置
            const posArray = positions;
            const velArray = velocities;
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                const deltaTime = 16 / 1000; // 假设60fps
                
                // 更新位置
                posArray[i3] += velArray[i3] * deltaTime;
                posArray[i3 + 1] += velArray[i3 + 1] * deltaTime;
                posArray[i3 + 2] += velArray[i3 + 2] * deltaTime;
                
                // 添加重力
                velArray[i3 + 1] -= 5 * deltaTime;
                
                // 添加阻力
                velArray[i3] *= 0.98;
                velArray[i3 + 1] *= 0.98;
                velArray[i3 + 2] *= 0.98;
            }
            
            geometry.attributes.position.needsUpdate = true;
            
            // 更新爆炸效果透明度
            explosion.material.opacity = 0.9 * (1 - progress);
            
            // 继续动画
            requestAnimationFrame(animateExplosion);
        };
        
        requestAnimationFrame(animateExplosion);
    }

    /**
     * 创建爆炸冲击波
     */
    createShockwave(position, isSuccess) {
        const shockwaveGeometry = new THREE.RingGeometry(0, 1, 32);
        const shockwaveMaterial = new THREE.MeshBasicMaterial({
            color: isSuccess ? 0x00ff00 : 0xff0000,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
        shockwave.position.copy(position);
        shockwave.lookAt(0, 0, 0); // 面向地球中心
        shockwave.renderOrder = 4;
        this.add(shockwave);
        
        // 冲击波动画
        const startTime = Date.now();
        const duration = 1000; // 1秒冲击波
        
        const animateShockwave = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                this.remove(shockwave);
                shockwaveGeometry.dispose();
                shockwaveMaterial.dispose();
                return;
            }
            
            // 冲击波扩散
            const scale = 1 + progress * 20;
            shockwave.scale.setScalar(scale);
            
            // 透明度衰减
            shockwave.material.opacity = 0.6 * (1 - progress);
            
            requestAnimationFrame(animateShockwave);
        };
        
        requestAnimationFrame(animateShockwave);
    }

    /**
     * 更新深度排序 - 基于相机移动距离触发
     */
    updateDepthSorting(delta) {
        if (!this.camera || !this.earth) return;
        
        // 修复：初始化相机位置记录（已在constructor中初始化，这里只需要设置初始值）
        if (this.lastCameraPosition === null) {
            this.lastCameraPosition = this.camera.position.clone();
            this.lastDepthSortTime = 0;
        }
        
        // 计算相机移动距离
        const cameraMovement = this.camera.position.distanceTo(this.lastCameraPosition);
        this.lastDepthSortTime += delta;
        
        // 触发深度排序的条件：
        // 1. 相机移动距离超过阈值（10单位）
        // 2. 或者距离上次排序超过固定时间间隔（1000ms）
        const shouldSort = cameraMovement > 10 || this.lastDepthSortTime > 1000;
        
        if (shouldSort) {
            // 更新相机位置记录
            this.lastCameraPosition.copy(this.camera.position);
            this.lastDepthSortTime = 0;
            
            // 修复：使用向量点积判断飞船是否在地球后面
            // 计算相机到地球中心的向量
            const cameraToEarth = new THREE.Vector3().subVectors(this.earth.position, this.camera.position).normalize();
            
            // 更新飞船的渲染顺序
            this.spaceships.forEach((spaceship, id) => {
                // 计算飞船到地球中心的向量
                const spaceshipToEarth = new THREE.Vector3().subVectors(this.earth.position, spaceship.position).normalize();
                
                // 修复：使用向量点积判断飞船是否在地球背离相机的一侧（即"后面"）
                // 如果点积 < 0，说明飞船在地球后面；如果点积 > 0，说明飞船在地球前面
                const dotProduct = cameraToEarth.dot(spaceshipToEarth);
                
                if (dotProduct < 0) {
                    spaceship.renderOrder = 1; // 在地球后面
                } else {
                    spaceship.renderOrder = 3; // 在地球前面
                }
            });
            
            // 更新光球攻击的渲染顺序
            this.attacks.forEach(attack => {
                if (attack.lightBall) {
                    attack.lightBall.renderOrder = 10; // 光球始终在最前面
                }
                if (attack.lightBallGlow) {
                    attack.lightBallGlow.renderOrder = 9; // 光晕在光球后面
                }
            });
        }
    }

    /**
     * 更新团队信息 - 基于排名的固定位置系统
     */
    updateTeams(teams) {
        // 限制最多20个飞船，只处理前20名
        const topTeams = teams.slice(0, this.maxShips);
        
        // 获取当前存在的飞船ID
        const currentTeamIds = new Set(this.spaceships.keys());
        const newTeamIds = new Set(topTeams.map(team => team.id));
        
        // 移除排名超出前20的飞船
        currentTeamIds.forEach(teamId => {
            if (!newTeamIds.has(teamId)) {
                console.log(`Removing spaceship for team ${teamId} - rank exceeded ${this.maxShips}`);
                this.removeSpaceship(teamId);
            }
        });
        
        // 为每个团队分配位置
        topTeams.forEach((team) => {
            const spaceship = this.spaceships.get(team.id);
            
            if (spaceship) {
                // 飞船已存在，检查排名是否变化
                const oldRank = spaceship.rank;
                const newRank = team.rank;
                
                if (oldRank !== newRank) {
                    console.log(`Team ${team.name} rank changed from ${oldRank} to ${newRank}`);

                    // 获取新排名对应的固定位置配置
                    const newPositionConfig = this.getRankPositionConfig(newRank);

                    // 更新飞船的目标位置参数
                    spaceship.targetOrbitRadius = newPositionConfig.orbitRadius;
                    spaceship.targetOrbitHeight = newPositionConfig.orbitHeight;
                    spaceship.targetOrbitOffset = newPositionConfig.orbitOffset;
                    spaceship.colorHue = newPositionConfig.colorHue;
                    spaceship.size = newPositionConfig.size;
                    spaceship.orbitSpeed = newPositionConfig.orbitSpeed;

                    // 排名变化脉冲光晕 + 平滑过渡
                    // 注：updateSpaceshipColor / updateTeamLabel 由 updateTeamInfo 根据
                    // rankChanged 守卫条件触发，此处不再重复调用
                    if (newRank < oldRank) {
                        spaceship.orbitTransitionSpeed = 0.03
                        spaceship.pulseGlow('up')
                    } else {
                        spaceship.orbitTransitionSpeed = 0.02
                        spaceship.pulseGlow('down')
                    }

                    console.log(`Spaceship ${team.name} moving to rank ${newRank} position - offset: ${newPositionConfig.orbitOffset.toFixed(2)} rad`);
                }
                
                // 更新其他团队信息（分数等）
                spaceship.updateTeamInfo(team);
                
            } else {
                // 创建新飞船 - 使用排名直接计算位置
                console.log(`Creating new spaceship for team ${team.name} (rank: ${team.rank})`);
                this.createSpaceshipAtRank(team);
            }
        });
        
        // 不再需要 redistributeOrbitOffsets()，每个排名有固定位置
    }
    
    /**
     * 重新分配轨道偏移，避免飞船重叠 - 新增方法
     */
    redistributeOrbitOffsets() {
        const spaceshipArray = Array.from(this.spaceships.values());
        
        // 按轨道分组
        const orbitGroups = {};
        spaceshipArray.forEach(spaceship => {
            const orbitKey = `${spaceship.orbitRadius}_${spaceship.orbitHeight}`;
            if (!orbitGroups[orbitKey]) {
                orbitGroups[orbitKey] = [];
            }
            orbitGroups[orbitKey].push(spaceship);
        });
        
        // 为每个轨道上的飞船平均分配角度
        Object.values(orbitGroups).forEach(group => {
            group.sort((a, b) => a.rank - b.rank);
            group.forEach((spaceship, index) => {
                const angle = (index / group.length) * Math.PI * 2;
                spaceship.orbitOffset = angle;
                
                // 修复：平滑调整飞船角度，保持与地球旋转同步
                // 计算角度差，然后平滑过渡
                const angleDiff = angle - (spaceship.angle % (Math.PI * 2));
                const normalizedDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
                spaceship.angle += normalizedDiff;
            });
        });
        
        console.log(`Redistributed orbit offsets for ${spaceshipArray.length} spaceships`);
    }

    /**
     * 检查是否需要更新轨道参数
     */
    needsOrbitUpdate(spaceship, newConfig) {
        const threshold = 10; // 轨道半径变化阈值
        return Math.abs(spaceship.orbitRadius - newConfig.orbitRadius) > threshold ||
            Math.abs(spaceship.orbitHeight - newConfig.orbitHeight) > threshold ||
            spaceship.colorHue !== newConfig.colorHue;
    }
    
    /**
     * 平滑更新飞船轨道参数 - 修复：移除轨道组迁移逻辑
     */
    updateSpaceshipOrbit(spaceship, newConfig) {
        // 修复：飞船直接添加到SpaceshipManager，无需轨道组迁移
        // 设置目标轨道参数，让飞船平滑过渡
        spaceship.targetOrbitRadius = newConfig.orbitRadius;
        spaceship.targetOrbitHeight = newConfig.orbitHeight;
        spaceship.colorHue = newConfig.colorHue;
        spaceship.size = newConfig.size;
        
        // 更新飞船颜色
        spaceship.updateSpaceshipColor();
        
        console.log(`Updated orbit for spaceship ${spaceship.teamName} - transitioning to radius: ${newConfig.orbitRadius}`);
    }

    /**
     * 移除飞船
     */
    removeSpaceship(teamId) {
        const spaceship = this.spaceships.get(teamId);
        if (spaceship) {
            this.remove(spaceship);
            spaceship.dispose();
            this.spaceships.delete(teamId);
        }
    }

    /**
     * 清理所有飞船
     */
    clearSpaceships() {
        // 清理所有飞船
        this.spaceships.forEach(spaceship => {
            spaceship.dispose();
        });
        this.spaceships.clear();
        
        // 修复：移除轨道组清理逻辑，飞船直接添加到SpaceshipManager
        // 轨道组已移除，飞船直接作为SpaceshipManager的子对象
        
        // 清理攻击
        this.attacks.forEach(attack => {
            // 清理攻击对象
            if (attack.objects && attack.objects.length > 0) {
                attack.objects.forEach(obj => {
                    this.remove(obj);
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(mat => mat.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                });
            }
            
            // 清理旧方法的攻击对象
            if (attack.lightBall) {
                this.remove(attack.lightBall);
                if (attack.lightBall.geometry) attack.lightBall.geometry.dispose();
                if (attack.lightBallMaterial) attack.lightBallMaterial.dispose();
            }
            if (attack.lightBallGlow) {
                this.remove(attack.lightBallGlow);
                if (attack.lightBallGlow.geometry) attack.lightBallGlow.geometry.dispose();
                if (attack.lightBallGlow.material) attack.lightBallGlow.material.dispose();
            }
        });
        this.attacks = [];

        // 清空延迟销毁队列（完整清理时立即处理所有待销毁资源）
        this._flushDeferredDisposals();

        // 清理所有爆炸特效
        this.clearAllExplosions();
    }

    /**
     * 立即清空延迟销毁队列
     */
    _flushDeferredDisposals() {
        while (this._pendingDisposals.length > 0) {
            const item = this._pendingDisposals.shift();
            if (item && item.ref && typeof item.ref.dispose === 'function') {
                item.ref.dispose();
            }
        }
    }

    /**
     * 清理所有爆炸特效
     */
    clearAllExplosions() {
        this.explosions.forEach(explosion => {
            explosion.rings.forEach(ring => {
                this.remove(ring);
                if (ring.geometry) ring.geometry.dispose();
                if (ring.material) ring.material.dispose();
            });

            this.remove(explosion.particleSystem);
            if (explosion.particleGeometry) explosion.particleGeometry.dispose();
            if (explosion.particleMaterial) explosion.particleMaterial.dispose();
        });
        this.explosions = [];
        console.log('All explosions cleared');
    }

    /**
     * 获取飞船数量
     */
    getSpaceshipCount() {
        return this.spaceships.size;
    }

    /**
     * 获取活跃攻击数量
     */
    getActiveAttackCount() {
        return this.attacks.length;
    }

    /**
     * 设置设备能力 - 修复：切换设备能力时自动清理超出飞船
     */
    setDeviceCapabilities(capabilities) {
        this.deviceCapabilities = capabilities;
        this.maxUpdatesPerFrame = capabilities.isMobile ? 3 : 8; // 根据设备调整更新频率
        
        const newMaxShips = capabilities.isMobile ? 15 : 20;
        const oldMaxShips = this.maxShips;
        this.maxShips = Math.min(this.maxShips, newMaxShips); // 根据设备调整最大飞船数
        
        // 修复：如果maxShips减少，自动清理超出数量的飞船
        if (newMaxShips < oldMaxShips && this.spaceships.size > newMaxShips) {
            console.log(`Device capabilities changed, cleaning up excess spaceships (${this.spaceships.size} -> ${newMaxShips})`);
            
            // 获取所有飞船并按某种规则排序（这里按创建顺序，实际可按排名等）
            const spaceshipArray = Array.from(this.spaceships.entries());
            
            // 移除超出新限制的飞船
            for (let i = newMaxShips; i < spaceshipArray.length; i++) {
                const [teamId, spaceship] = spaceshipArray[i];
                console.log(`Removing excess spaceship for team ${teamId}`);
                this.removeSpaceship(teamId);
            }
        }
    }

    /**
     * 递归收集可销毁的 GPU 资源（包括 Group 子节点）
     */
    _collectDisposables(obj) {
        const items = [];
        const stack = [obj];
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) continue;
            if (current.geometry) items.push({ type: 'geometry', ref: current.geometry });
            if (current.material) {
                if (Array.isArray(current.material)) {
                    current.material.forEach(m => items.push({ type: 'material', ref: m }));
                } else {
                    items.push({ type: 'material', ref: current.material });
                }
            }
            // 递归子节点（处理 THREE.Group 等容器）
            if (current.children && current.children.length > 0) {
                for (const child of current.children) {
                    stack.push(child);
                }
            }
        }
        return items;
    }

    /**
     * 每帧分批处理延迟销毁队列
     */
    _processDeferredDisposals() {
        if (this._pendingDisposals.length === 0) return;
        const count = Math.min(this._maxDisposalsPerFrame, this._pendingDisposals.length);
        for (let i = 0; i < count; i++) {
            const item = this._pendingDisposals.shift();
            if (item && item.ref && typeof item.ref.dispose === 'function') {
                item.ref.dispose();
            }
        }
    }

    /**
     * 清理资源
     */
    dispose() {
        // 先清空延迟销毁队列
        this._pendingDisposals.forEach(item => {
            if (item && item.ref && typeof item.ref.dispose === 'function') {
                item.ref.dispose();
            }
        });
        this._pendingDisposals = [];

        this.clearSpaceships();

        this.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
