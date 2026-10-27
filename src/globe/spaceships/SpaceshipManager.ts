import * as THREE from 'three';
import AttackSystem from './attacks/AttackSystem';
import Spaceship from './Spaceship';
import { disposeSpaceshipPrototype } from './shipModel';

interface DeviceCapabilities {
    isMobile: boolean;
    renderQuality: number;
}

interface SpaceshipManagerConfig {
    earthRadius?: number;
    maxShips?: number;
    deviceCapabilities?: DeviceCapabilities;
}

export default class SpaceshipManager extends THREE.Object3D {
    earthRadius: number;
    maxShips: number;
    deviceCapabilities: DeviceCapabilities;
    spaceships: Map<number, any>;
    attackSystem: AttackSystem;
    depthSortingEnabled: boolean;
    camera: any;
    earth: any;
    forcedUpdateShipId: number | null;
    lastCameraPosition: THREE.Vector3 | null;
    lastDepthSortTime: number;

    /**
     * 3D飞船管理器
     * @param {{
     *   earthRadius?: number,
     *   maxShips?: number,
     *   deviceCapabilities?: any
     * }} config 
     */
    constructor(config: SpaceshipManagerConfig = {}) {
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

        // 攻击与爆炸特效
        this.attackSystem = new AttackSystem(this);
        this.add(this.attackSystem);

        // 深度排序
        this.depthSortingEnabled = true;
        
        // 相机引用（用于深度计算）
        this.camera = null;
        this.earth = null;
        this.forcedUpdateShipId = null;
        
        // 修复：初始化深度排序相关属性，避免undefined错误
        this.lastCameraPosition = null;
        this.lastDepthSortTime = 0;
    }

    /**
     * 设置相机和地球引用
     */
    setReferences(camera: any, earth: any): void {
        this.camera = camera;
        this.earth = earth;
    }

    setForcedUpdateShipId(teamId: number | null): void {
        this.forcedUpdateShipId = teamId ?? null;
    }

    /**
     * 根据排名计算固定位置配置 - 新方法，每个排名对应唯一位置
     * @param {number} rank - 排名（1-20）
     * @returns {Object} 轨道配置
     */
    getRankPositionConfig(rank: number) {
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
    createSpaceshipAtRank(teamInfo: any) {
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
     * 更新所有飞船
     */
    update(delta: number): void {
        // 更新所有飞船位置，这计算量很小，避免分帧导致的抖动
        const spaceshipArray = Array.from(this.spaceships.values());
        
        for (let i = 0; i < spaceshipArray.length; i++) {
            const spaceship = spaceshipArray[i];
            if (spaceship && spaceship.modelLoaded) {
                spaceship.updatePosition(delta);
            }
        }

        // 更新攻击与爆炸特效
        this.attackSystem.update(delta);

        // 深度排序 - 基于相机移动距离触发
        if (this.depthSortingEnabled && this.camera) {
            this.updateDepthSorting(delta);
        }
    }

    /**
     * 创建一次攻击特效。具体实现由 AttackSystem 负责。
     */
    createAttack(fromTeamId: number, targetCountry: any, challengeInfo: any): any {
        return this.attackSystem.createAttack(fromTeamId, targetCountry, challengeInfo);
    }

    /**
     * 更新深度排序 - 基于相机移动距离触发
     */
    updateDepthSorting(delta: number): void {
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
            this.lastCameraPosition?.copy(this.camera.position);
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
        }
    }

    /**
     * 更新团队信息 - 基于排名的固定位置系统
     */
    updateTeams(teams: any[]): void {
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
     * 移除飞船
     */
    removeSpaceship(teamId: number): void {
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
    clearSpaceships(): void {
        // 清理所有飞船
        this.spaceships.forEach(spaceship => {
            this.remove(spaceship);
            spaceship.dispose();
        });
        this.spaceships.clear();

        this.attackSystem.clearAll();
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.attackSystem.dispose();
        this.clearSpaceships();

        this.traverse(child => {
            const node = child as THREE.Mesh;
            node.geometry?.dispose();
            if (Array.isArray(node.material)) {
                node.material.forEach((material) => material.dispose());
            } else {
                node.material?.dispose();
            }
        });

        disposeSpaceshipPrototype();
    }
}
