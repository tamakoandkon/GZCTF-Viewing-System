import * as THREE from 'three';
import gsap from 'gsap';
import CameraDirector from './CameraDirector';

/**
 * 自动展示系统
 * 负责管理前三名展示和运镜轮换的自动调度
 */
export default class AutoShowcaseSystem {
    cameraDirector: any
    spaceshipManager: any
    top3ShowcaseInterval: number
    cameraRotationInterval: number
    isActive: boolean
    isShowcasing: boolean
    isRotatingCamera: boolean
    top3Timer: any
    cameraTimer: any
    followAnimationFrame: any
    currentShowcaseSpaceships: any[]
    currentSpaceshipIndex: number
    showcaseStartTime: number
    spaceshipShowcaseTimeline: any
    isTransitioning: boolean
    currentFollowingSpaceship: any
    shouldFollow: boolean
    followEndTime: number
    transitionTargetSpaceship: any
    transitionEndTime: number
    followParams: any
    _tmp: any
    cameraModes: string[]
    currentCameraModeIndex: number
    showcaseDuration: number
    cameraSequenceDuration: number
    lastShowcaseTime: number
    lastCameraTime: number
    minIntervalBetweenActions: number
    userSuppressUntil: number
    onShowcaseStart: any
    onShowcaseEnd: any
    onCameraModeChange: any
    constructor(cameraDirector: any, spaceshipManager: any) {
        this.cameraDirector = cameraDirector;
        this.spaceshipManager = spaceshipManager;
        
        // 时间配置（毫秒）
        this.top3ShowcaseInterval = 5 * 60 * 1000; // 5分钟
        this.cameraRotationInterval = 3 * 60 * 1000; // 3分钟
        
        // 状态管理
        this.isActive = false;
        this.isShowcasing = false;
        this.isRotatingCamera = false;
        
        // 定时器
        this.top3Timer = null;
        this.cameraTimer = null;
        
        // 动态跟随相关
        this.followAnimationFrame = null;
        this.currentShowcaseSpaceships = [];
        this.currentSpaceshipIndex = 0;
        this.showcaseStartTime = 0;
        this.spaceshipShowcaseTimeline = null; // 运镜时间轴
        this.isTransitioning = false; // 是否正在过渡
        this.currentFollowingSpaceship = null; // 当前正在跟随的飞船
        this.shouldFollow = false; // 是否应该继续跟随
        this.followEndTime = 0;
        this.transitionTargetSpaceship = null;
        this.transitionEndTime = 0;
        this.followParams = {
            offsetBack: 60,
            offsetUp: 36,
            offsetRight: 0,
            targetUp: 6,
            leadTime: 0.0, // Disable lead time to remove velocity-based jitter
            maxLeadDistance: 60,
            horizonLock: false, // Disable horizon lock to avoid using noisy shipVel
            velocityForwardMin: 1.5,
            velocityForwardRange: 3.0,
            predictionAccelFactor: 0.0, // Disable acceleration prediction
            maxPredictedAcc: 600,
            forwardFilterSpeed: 5.0,
            leadFilterSpeed: 5.0,
            positionDeadzone: 0.0, // Remove deadzone to prevent micro-stutters
            targetDeadzone: 0.0,   // Remove deadzone
            positionSpeed: 3.5,    // Lower speed for smoother tracking
            targetSpeed: 4.5,
            rotationSpeed: 3.0,
            catchUpBoost: 2.5,
            maxLagDistance: 40,
            minShipDistance: 18,
            maxShipDistance: 600,
            earthSafetyFactor: 1.05
        };
        this._tmp = {
            shipPos: new THREE.Vector3(),
            shipQuat: new THREE.Quaternion(),
            shipForward: new THREE.Vector3(),
            quatForward: new THREE.Vector3(),
            shipRight: new THREE.Vector3(),
            shipUp: new THREE.Vector3(),
            desiredPos: new THREE.Vector3(),
            desiredTarget: new THREE.Vector3(),
            leadPos: new THREE.Vector3(),
            filteredForward: new THREE.Vector3(0, 0, 1),
            filteredLeadPos: new THREE.Vector3(),
            prevShipPos: new THREE.Vector3(),
            shipVel: new THREE.Vector3(),
            prevShipVel: new THREE.Vector3(),
            shipAcc: new THREE.Vector3(),
            needsWarmStart: false,
            desiredQuat: new THREE.Quaternion(),
            lookAtHelper: new THREE.Object3D(),
            origin: new THREE.Vector3(0, 0, 0),
            v: new THREE.Vector3()
        };
        
        // 运镜模式列表
        this.cameraModes = ['orbit', 'zoomIn', 'dive', 'spiral', 'followSpaceship'];
        this.currentCameraModeIndex = 0;
        
        // 展示配置
        this.showcaseDuration = 30000; // 30秒展示时间
        this.cameraSequenceDuration = 12000; // 12秒运镜时间
        
        // 冲突控制
        this.lastShowcaseTime = 0;
        this.lastCameraTime = 0;
        this.minIntervalBetweenActions = 10000; // 最小间隔10秒
        this.userSuppressUntil = 0;
        
        // 事件回调
        this.onShowcaseStart = null;
        this.onShowcaseEnd = null;
        this.onCameraModeChange = null;
        
        console.log('AutoShowcaseSystem initialized');
    }
  setFollowParams(params: any = {}) {
        if (!params || typeof params !== 'object') return;
        Object.entries(params).forEach(([key, value]) => {
            if (!(key in this.followParams)) return;
            if (typeof value !== 'number' && typeof value !== 'boolean') return;
            // basic validation
            if (typeof value === 'number' && !Number.isFinite(value)) return;
            this.followParams[key] = value;
        });
    }
  update(delta: any) {
        if (!this.isShowcasing || !this.cameraDirector) return;

        const now: number = performance.now();

        if (this.isTransitioning) {
            if (this.transitionEndTime && now >= this.transitionEndTime) {
                this.isTransitioning = false;
                this.transitionTargetSpaceship = null;
                this.transitionEndTime = 0;
                this.spaceshipManager?.setForcedUpdateShipId?.(null);
            } else {
                if (!this.transitionTargetSpaceship || !this.transitionTargetSpaceship.modelLoaded) {
                    const fallback = this.getTop3Spaceships()[0];
                    if (fallback) {
                        this.startTransitionToSpaceship(fallback, 1.2);
                    } else {
                        this.stopTop3Showcase();
                    }
                    return;
                }
                this.updateCameraFollow(this.transitionTargetSpaceship, delta, true);
                return;
            }
        }

        if (!this.shouldFollow) return;

        if (!this.currentFollowingSpaceship || !this.currentFollowingSpaceship.modelLoaded) {
            const fallback = this.getTop3Spaceships()[0];
            if (fallback) {
                this.shouldFollow = false;
                this.currentFollowingSpaceship = null;
                this.followEndTime = 0;
                this.startTransitionToSpaceship(fallback, 1.2);
            } else {
                this.stopTop3Showcase();
            }
            return;
        }

        if (this.followEndTime && now >= this.followEndTime) {
            this.shouldFollow = false;
            this.currentFollowingSpaceship = null;
            this.followEndTime = 0;
            this.spaceshipManager?.setForcedUpdateShipId?.(null);
            return;
        }

        this.updateCameraFollow(this.currentFollowingSpaceship, delta);
    }
  startTransitionToSpaceship(spaceship: any, duration = 2.0) {
        if (!spaceship || !this.cameraDirector) return;
        if (!Number.isFinite(duration) || duration <= 0) duration = 1.2;

        this.shouldFollow = false;
        this.currentFollowingSpaceship = null;
        this.followEndTime = 0;

        this.isTransitioning = true;
        this.transitionTargetSpaceship = spaceship;
        this.transitionEndTime = performance.now() + duration * 1000;
        this.currentSpaceshipIndex = this.currentShowcaseSpaceships.indexOf(spaceship);

        this.spaceshipManager?.setForcedUpdateShipId?.(spaceship.teamId);

        const targetObj = spaceship.spaceshipMesh || spaceship;
        targetObj.getWorldPosition(this._tmp.prevShipPos);
        this._tmp.shipVel.set(0, 0, 0);
        this._tmp.prevShipVel.set(0, 0, 0);
        this._tmp.shipAcc.set(0, 0, 0);
        this._tmp.filteredLeadPos.copy(this._tmp.prevShipPos);
        this._tmp.filteredForward.set(0, 0, 1);
        this._tmp.needsWarmStart = true;
    }
    
    /**
     * 启动自动展示系统
     */
    start() {
        if (this.isActive) {
            console.warn('AutoShowcaseSystem is already active');
            return;
        }
        
        this.isActive = true;
        this.startTimers();
        
        console.log('AutoShowcaseSystem started');
    }
    
    /**
     * 停止自动展示系统
     */
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.clearTimers();
        
        // 如果正在展示，停止展示
        if (this.isShowcasing) {
            this.stopTop3Showcase();
        }
        
        console.log('AutoShowcaseSystem stopped');
    }
    
    /**
     * 启动定时器
     */
    startTimers() {
        // 启动前三名展示定时器
        this.top3Timer = setInterval(() => {
            this.scheduleTop3Showcase();
        }, this.top3ShowcaseInterval);
        
        // 启动运镜轮换定时器
        this.cameraTimer = setInterval(() => {
            this.scheduleCameraRotation();
        }, this.cameraRotationInterval);
        
        console.log('Timers started - Top3: 5min, Camera: 3min');
    }
    
    /**
     * 清除定时器
     */
    clearTimers() {
        if (this.top3Timer) {
            clearInterval(this.top3Timer);
            this.top3Timer = null;
        }
        
        if (this.cameraTimer) {
            clearInterval(this.cameraTimer);
            this.cameraTimer = null;
        }
    }
    
    /**
     * 调度前三名展示
     */
    scheduleTop3Showcase() {
        if (!this.isActive) return;
        
        const now = Date.now();
        if (now < this.userSuppressUntil) {
            setTimeout(() => {
                this.scheduleTop3Showcase();
            }, 5000);
            return;
        }
        
        // 检查是否与运镜轮换冲突
        if (this.isRotatingCamera || 
            (now - this.lastCameraTime) < this.minIntervalBetweenActions) {
            console.log('Top3 showcase delayed due to camera rotation conflict');
            // 延迟5秒后重试
            setTimeout(() => {
                this.scheduleTop3Showcase();
            }, 5000);
            return;
        }
        if (this.cameraDirector && this.cameraDirector.isRunning() && !this.isShowcasing) {
            this.cameraDirector.interruptSequence();
        }
        
        this.startTop3Showcase();
    }
    
    /**
     * 调度运镜轮换
     */
    scheduleCameraRotation() {
        if (!this.isActive) return;
        
        const now = Date.now();
        if (now < this.userSuppressUntil) {
            setTimeout(() => {
                this.scheduleCameraRotation();
            }, 5000);
            return;
        }
        
        // 检查是否与前三名展示冲突
        if (this.isShowcasing || 
            (now - this.lastShowcaseTime) < this.minIntervalBetweenActions) {
            console.log('Camera rotation delayed due to showcase conflict');
            // 延迟5秒后重试
            setTimeout(() => {
                this.scheduleCameraRotation();
            }, 5000);
            return;
        }
        if (this.cameraDirector && this.cameraDirector.isRunning()) {
            setTimeout(() => {
                this.scheduleCameraRotation();
            }, 5000);
            return;
        }
        
        this.startCameraRotation();
    }
    
    /**
     * 开始前三名展示
     */
    startTop3Showcase() {
        if (this.isShowcasing || !this.cameraDirector || !this.spaceshipManager) {
            return;
        }
        
        // 获取前三名飞船
        const top3Spaceships = this.getTop3Spaceships();
        if (top3Spaceships.length === 0) {
            console.log('No spaceships available for showcase');
            return;
        }
        
        if (this.cameraDirector.isRunning()) {
            this.cameraDirector.interruptSequence();
        }

        this.isShowcasing = true;
        this.lastShowcaseTime = Date.now();
        
        console.log(`Starting Top3 showcase for ${top3Spaceships.length} spaceships`);
        
        // 触发开始回调
        if (this.onShowcaseStart) {
            this.onShowcaseStart(top3Spaceships);
        }
        
        // 创建前三名展示运镜
        this.createTop3ShowcaseSequence(top3Spaceships);
        
        // 设置展示结束定时器
        setTimeout(() => {
            this.stopTop3Showcase();
        }, this.showcaseDuration);
    }
    
    /**
     * 停止前三名展示
     */
    stopTop3Showcase() {
        if (!this.isShowcasing) return;
        
        this.isShowcasing = false;
        this.isTransitioning = false;
        this.shouldFollow = false;
        this.currentFollowingSpaceship = null;
        this.followEndTime = 0;
        this.transitionTargetSpaceship = null;
        this.transitionEndTime = 0;
        this.spaceshipManager?.setForcedUpdateShipId?.(null);
        
        // 停止跟随循环
        if (this.followAnimationFrame) {
            cancelAnimationFrame(this.followAnimationFrame);
            this.followAnimationFrame = null;
        }
        
        // 停止运镜时间轴
        if (this.spaceshipShowcaseTimeline) {
            this.spaceshipShowcaseTimeline.kill();
            this.spaceshipShowcaseTimeline = null;
        }
        
        // 停止所有GSAP动画
        if (this.cameraDirector) {
            gsap.killTweensOf(this.cameraDirector.camera.position);
            gsap.killTweensOf(this.cameraDirector.controls.target);
            
            // 立即返回原始位置
            this.returnToOriginalPosition();
        }
        
        // 触发结束回调
        if (this.onShowcaseEnd) {
            this.onShowcaseEnd();
        }
        
        console.log('Top3 showcase ended');
    }
    
    /**
     * 开始运镜轮换
     */
    startCameraRotation() {
        if (this.isRotatingCamera || !this.cameraDirector) {
            return;
        }
        if (this.cameraDirector.isRunning()) {
            setTimeout(() => {
                this.scheduleCameraRotation();
            }, 5000);
            return;
        }
        
        this.isRotatingCamera = true;
        this.lastCameraTime = Date.now();
        
        // 获取下一个运镜模式
        const nextMode = this.cameraModes[this.currentCameraModeIndex];
        this.currentCameraModeIndex = (this.currentCameraModeIndex + 1) % this.cameraModes.length;
        
        console.log(`Starting camera rotation to mode: ${nextMode}`);
        
        // 触发模式变化回调
        if (this.onCameraModeChange) {
            this.onCameraModeChange(nextMode);
        }
        
        // 开始运镜序列
        const success = this.cameraDirector.startSequence(nextMode);
        
        if (success) {
            // 设置运镜结束定时器
            setTimeout(() => {
                this.stopCameraRotation();
            }, this.cameraSequenceDuration);
        } else {
            this.isRotatingCamera = false;
        }
    }
    
    /**
     * 停止运镜轮换
     */
    stopCameraRotation() {
        if (!this.isRotatingCamera) return;
        
        this.isRotatingCamera = false;
        
        console.log('Camera rotation ended');
    }
    
    /**
     * 获取前三名飞船
     */
    getTop3Spaceships() {
        if (!this.spaceshipManager) return [];
        
        const spaceships = Array.from(this.spaceshipManager.spaceships.values())
            .filter((spaceship: any) => spaceship.modelLoaded)
            .sort((a: any, b: any) => a.rank - b.rank)
            .slice(0, 3);
        
        return spaceships;
    }
    
    /**
     * 创建前三名展示运镜序列 - 修复：依次展示前三名，每切换时都有平滑的运镜过渡
     */
  createTop3ShowcaseSequence(spaceships: any) {
        if (!this.cameraDirector || spaceships.length === 0) return;
        
        // 保存当前展示的飞船列表
        this.currentShowcaseSpaceships = spaceships;
        this.currentSpaceshipIndex = 0;
        this.showcaseStartTime = Date.now();
        this.isTransitioning = false;
        
        // 等待一小段时间，确保飞船位置稳定
        setTimeout(() => {
            // 保存当前相机状态
            this.cameraDirector.saveCurrentState();
            
            // 设置运镜状态
            this.cameraDirector.isDirecting = true;
            this.cameraDirector.currentSequence = 'top3Showcase';
            
            // 禁用用户控制
            this.cameraDirector.controls.enabled = false;
            this.cameraDirector.controls.autoRotate = false;
            
            // 修复运镜bug：禁用damping
            this.cameraDirector.originalState.enableDamping = this.cameraDirector.controls.enableDamping;
            this.cameraDirector.originalState.dampingFactor = this.cameraDirector.controls.dampingFactor;
            this.cameraDirector.controls.enableDamping = false;
            
            // 创建展示时间轴，依次展示每个飞船
            this.createShowcaseTimeline(spaceships);
        }, 500); // 等待500ms让飞船位置稳定
    }
    
    /**
     * 创建展示时间轴 - 依次展示每个飞船，带有平滑的过渡运镜
     */
  createShowcaseTimeline(spaceships: any) {
        if (!this.cameraDirector || spaceships.length === 0) return;
        
        // 计算每个飞船的展示时间和过渡时间
        const transitionDuration = 2.5; // 切换过渡时间（秒）
        const totalShowcaseTime = this.showcaseDuration / 1000; // 总展示时间（秒）
        const showcaseTimePerSpaceship = (totalShowcaseTime - (spaceships.length * transitionDuration)) / spaceships.length; // 每个飞船的实际展示时间
        
        // 创建GSAP时间轴
        this.spaceshipShowcaseTimeline = gsap.timeline({
            onComplete: () => {
                // 所有飞船展示完成后，平滑返回原始位置
                this.returnToOriginalPosition();
            }
        });
        
        let currentTime: any = 0;
        
        spaceships.forEach((spaceship: any, index: any) => {
            // 如果是第一个飞船，先过渡到第一个飞船位置
            if (index === 0) {
                this.addTransitionToSpaceship(spaceship, currentTime, transitionDuration);
                currentTime += transitionDuration;
            }
            
            // 添加跟随动画（展示当前飞船）
            this.addFollowSpaceship(spaceship, currentTime, showcaseTimePerSpaceship);
            currentTime += showcaseTimePerSpaceship;
            
            // 如果不是最后一个飞船，添加过渡到下一个飞船的动画
            if (index < spaceships.length - 1) {
                const nextSpaceship = spaceships[index + 1];
                this.addTransitionToSpaceship(nextSpaceship, currentTime, transitionDuration);
                currentTime += transitionDuration;
            }
        });
    }
    
    /**
     * 添加过渡到飞船的运镜动画
     */
  addTransitionToSpaceship(spaceship: any, startTime: any, duration: any) {
        if (!spaceship || !this.cameraDirector) return;
        
        // 在时间轴的指定时间开始过渡
        this.spaceshipShowcaseTimeline.call(() => {
            this.startTransitionToSpaceship(spaceship, duration);
        }, null, startTime);
    }
    
    /**
     * 添加跟随飞船的动画
     */
  addFollowSpaceship(spaceship: any, startTime: any, duration: any) {
        if (!spaceship || !this.cameraDirector) return;
        
        // 在时间轴的指定时间启动跟随
        this.spaceshipShowcaseTimeline.call(() => {
            // 设置当前跟随的飞船
            this.currentFollowingSpaceship = spaceship;
            this.shouldFollow = true;
            this.isTransitioning = false;
            this.currentSpaceshipIndex = this.currentShowcaseSpaceships.indexOf(spaceship);
            this.followEndTime = performance.now() + duration * 1000;
            this.spaceshipManager?.setForcedUpdateShipId?.(spaceship.teamId);
            
            const targetObj = spaceship.spaceshipMesh || spaceship;
            targetObj.getWorldPosition(this._tmp.prevShipPos);
            this._tmp.shipVel.set(0, 0, 0);
            this._tmp.prevShipVel.set(0, 0, 0);
            this._tmp.shipAcc.set(0, 0, 0);
            this._tmp.filteredLeadPos.copy(this._tmp.prevShipPos);
            targetObj.getWorldQuaternion(this._tmp.shipQuat);
            this._tmp.filteredForward.set(0, 0, 1).applyQuaternion(this._tmp.shipQuat).normalize();
            this._tmp.needsWarmStart = true;
        }, null, startTime);
    }
    
    /**
     * 过渡到指定飞船
     */
  transitionToSpaceship(spaceship: any, duration = 2.0, onComplete: any = null) {
        if (!spaceship || !this.cameraDirector) return;
        
        // 获取飞船当前位置
        const spaceshipPosition = new THREE.Vector3();
        spaceship.getWorldPosition(spaceshipPosition);
        
        // 计算目标位置
        const targetPosition = spaceshipPosition.clone();
        targetPosition.y += 5;
        
        // 计算相机位置
        const spaceshipSize = spaceship.size || 1;
        const baseDistance = 50;
        const adjustedDistance = baseDistance * spaceshipSize;
        const cameraOffset = new THREE.Vector3(0, adjustedDistance * 0.6, -adjustedDistance);
        const cameraPosition = spaceshipPosition.clone().add(cameraOffset);
        
        // 使用GSAP平滑过渡
        gsap.to(this.cameraDirector.camera.position, {
            duration: duration,
            x: cameraPosition.x,
            y: cameraPosition.y,
            z: cameraPosition.z,
            ease: "power3.inOut",
            onComplete: onComplete
        });
        
        gsap.to(this.cameraDirector.controls.target, {
            duration: duration,
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z,
            ease: "power3.inOut"
        });
    }
    
    
    /**
     * 更新相机跟随位置 - 彻底重构：实现零抖动绝对位置跟踪
     * 使用平滑阻尼算法，并添加亚像素级防抖检测
     */
  updateCameraFollow(spaceship: any, delta: any, ignoreTransition: any = false) {
        if (!spaceship || !this.cameraDirector || (!ignoreTransition && this.isTransitioning)) return;
        if (!Number.isFinite(delta) || delta <= 0) return;
        const camera = this.cameraDirector.camera;
        const controls = this.cameraDirector.controls;
        if (!camera || !controls) return;

        // 1. 获取目标飞船的基础数据
        const shipPos = this._tmp.shipPos;
        spaceship.getWorldPosition(shipPos); // 使用飞船根节点坐标，避免mesh的局部轻微抖动

        // 2. 获取飞船朝向（忽略上下颠簸导致的俯仰角，确保运镜水平稳定）
        const shipQuat = this._tmp.shipQuat;
        if (spaceship.spaceshipMesh) {
            spaceship.spaceshipMesh.getWorldQuaternion(shipQuat);
        } else {
            spaceship.getWorldQuaternion(shipQuat);
        }
        
        // 计算前向向量，并将其投影到水平面 (Y=0) 以消除垂直抖动
        const forward = this._tmp.shipForward.set(0, 0, 1).applyQuaternion(shipQuat);
        forward.y = 0;
        if (forward.lengthSq() > 0.001) {
            forward.normalize();
        } else {
            forward.set(0, 0, 1);
        }

        const up = this._tmp.shipUp.set(0, 1, 0);

        // 3. 计算理想的相机绝对坐标 (世界坐标系)
        const size = spaceship.size || 1;
        const offsetBack = this.followParams.offsetBack * size;
        const offsetUp = this.followParams.offsetUp * size;
        const targetUp = this.followParams.targetUp * size;

        // 理想相机位置：飞船位置 + 沿朝向向后 + 向上
        const desiredPos = this._tmp.desiredPos
            .copy(shipPos)
            .addScaledVector(forward, -offsetBack)
            .addScaledVector(up, offsetUp);

        // 理想目标点：飞船位置 + 向上偏移
        const desiredTarget = this._tmp.desiredTarget
            .copy(shipPos)
            .addScaledVector(up, targetUp);

        // 4. 实现平滑阻尼算法，根据距离动态调整阻尼，实现从平滑插值到刚性绑定的无缝过渡
        const distPos = camera.position.distanceTo(desiredPos);
        const distTarget = controls.target.distanceTo(desiredTarget);

        // 距离越大阻尼越大（平滑过渡），距离越小阻尼越小（刚性跟随）
        let damping = 0.15;
        
        // 如果处于完全跟随状态（非过渡期），并且已经非常接近目标，直接采用刚性绑定，实现0像素偏移
        // 阈值设为0.5单位以便快速吸附，之后始终保持完全锁定
        if (!this.isTransitioning && distPos < 0.5) {
            camera.position.copy(desiredPos);
            controls.target.copy(desiredTarget);
            camera.lookAt(controls.target);
            return;
        }

        if (distPos < 10.0) {
            // 当距离较近时，逐渐减小阻尼，增强跟随的刚性
            damping = Math.max(0.05, 0.15 * (distPos / 10.0));
        }
        
        // 转换为帧率无关的插值系数
        const lerpFactor = 1 - Math.exp(-(1.0 / damping) * delta);

        // 5. 添加位置阈值检测 (≤0.01单位) - 消除亚像素级微小震颤，实现绝对锁定
        if (distPos <= 0.01) {
            camera.position.copy(desiredPos); // 刚性绑定，消除相对位移
        } else {
            camera.position.lerp(desiredPos, lerpFactor); // 精确插值
        }

        if (distTarget <= 0.01) {
            controls.target.copy(desiredTarget);
        } else {
            controls.target.lerp(desiredTarget, lerpFactor);
        }

        // 6. 更新摄像机朝向
        camera.lookAt(controls.target);
    }
    
    /**
     * 返回原始位置
     */
    returnToOriginalPosition() {
        if (!this.cameraDirector) return;
        
        // 停止跟随循环
        if (this.followAnimationFrame) {
            cancelAnimationFrame(this.followAnimationFrame);
            this.followAnimationFrame = null;
        }
        
        const tl = gsap.timeline({
            onComplete: () => {
                this.completeShowcase();
            }
        });

        tl.to(this.cameraDirector.camera.position, {
            duration: 2,
            x: this.cameraDirector.originalState.position.x,
            y: this.cameraDirector.originalState.position.y,
            z: this.cameraDirector.originalState.position.z,
            ease: "power2.inOut"
        }, 0);

        tl.to(this.cameraDirector.controls.target, {
            duration: 2,
            x: this.cameraDirector.originalState.target.x,
            y: this.cameraDirector.originalState.target.y,
            z: this.cameraDirector.originalState.target.z,
            ease: "power2.inOut"
        }, 0);
    }
    
    /**
     * 完成展示
     */
    completeShowcase() {
        if (!this.cameraDirector) return;
        
        const controls = this.cameraDirector.controls;
        const original = this.cameraDirector.originalState;

        controls.enabled = false;
        controls.autoRotate = false;
        controls.enableDamping = false;
        controls.dampingFactor = 0;
        controls.update();

        requestAnimationFrame(() => {
            controls.enableDamping = original.enableDamping;
            controls.dampingFactor = original.dampingFactor;
            controls.autoRotate = original.autoRotate;
            controls.enabled = true;
            controls.update();

            this.cameraDirector.isDirecting = false;
            this.cameraDirector.currentSequence = null;
            this.currentShowcaseSpaceships = [];
            this.currentSpaceshipIndex = 0;
        });
    }
    
    /**
     * 生成前三名展示的关键帧
     */
  generateTop3Keyframes(spaceships: any) {
        const keyframes: any = [];
        const duration = this.showcaseDuration / 1000;
        const segmentDuration = duration / spaceships.length;
        
        spaceships.forEach((spaceship: any, index: any) => {
            const startTime = index * segmentDuration;
            const endTime = (index + 1) * segmentDuration;
            
            // 获取飞船位置（使用传入的位置或当前位置）
            const spaceshipPosition = spaceship.position ? spaceship.position.clone() : spaceship.getWorldPosition(new THREE.Vector3());
            const targetPosition = spaceshipPosition.clone();
            targetPosition.y += 5; // 进一步减少向上偏移，让目标更接近飞船中心
            
            // 计算相机位置（更近距离，更好的视角）
            // 根据飞船大小调整相机距离
            const spaceshipSize = spaceship.size || 1;
            const baseDistance = 50; // 基础距离
            const adjustedDistance = baseDistance * spaceshipSize; // 根据飞船大小调整
            
            const cameraOffset = new THREE.Vector3(0, adjustedDistance * 0.6, -adjustedDistance); // 更合理的相机位置
            const cameraPosition = spaceshipPosition.clone().add(cameraOffset);
            
            // 添加关键帧
            keyframes.push({
                time: startTime,
                position: cameraPosition,
                target: targetPosition
            });
            
            // 如果是最后一个飞船，添加返回原位的关键帧
            if (index === spaceships.length - 1) {
                keyframes.push({
                    time: endTime,
                    position: { x: 0, y: 50, z: -400 },
                    target: { x: 0, y: 0, z: 0 }
                });
            }
        });
        
        return keyframes;
    }
    
    /**
     * 手动触发前三名展示
     */
    triggerTop3Showcase() {
        if (this.isActive && !this.isShowcasing && !this.isRotatingCamera) {
            this.startTop3Showcase();
        }
    }
    
    /**
     * 手动触发运镜轮换
     */
    triggerCameraRotation() {
        if (this.isActive && !this.isRotatingCamera && !this.isShowcasing) {
            this.startCameraRotation();
        }
    }
    
    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isActive: this.isActive,
            isShowcasing: this.isShowcasing,
            isRotatingCamera: this.isRotatingCamera,
            currentCameraMode: this.cameraModes[this.currentCameraModeIndex],
            nextShowcaseIn: this.top3ShowcaseInterval - (Date.now() - this.lastShowcaseTime),
            nextCameraRotationIn: this.cameraRotationInterval - (Date.now() - this.lastCameraTime)
        };
    }
    
    /**
     * 设置事件回调
     */
  setCallbacks(callbacks: any) {
        if (callbacks.onShowcaseStart) this.onShowcaseStart = callbacks.onShowcaseStart;
        if (callbacks.onShowcaseEnd) this.onShowcaseEnd = callbacks.onShowcaseEnd;
        if (callbacks.onCameraModeChange) this.onCameraModeChange = callbacks.onCameraModeChange;
    }
  suppressAuto(durationMs = 15000) {
        const now = Date.now();
        this.userSuppressUntil = Math.max(this.userSuppressUntil, now + durationMs);
    }
    
    /**
     * 更新配置
     */
  updateConfig(config: any) {
        if (config.top3ShowcaseInterval) {
            this.top3ShowcaseInterval = config.top3ShowcaseInterval;
        }
        if (config.cameraRotationInterval) {
            this.cameraRotationInterval = config.cameraRotationInterval;
        }
        if (config.showcaseDuration) {
            this.showcaseDuration = config.showcaseDuration;
        }
        if (config.cameraSequenceDuration) {
            this.cameraSequenceDuration = config.cameraSequenceDuration;
        }
        
        // 如果系统正在运行，重启定时器
        if (this.isActive) {
            this.clearTimers();
            this.startTimers();
        }
    }
    
    /**
     * 清理资源
     */
    dispose() {
        this.stop();
        
        // 停止跟随循环
        if (this.followAnimationFrame) {
            cancelAnimationFrame(this.followAnimationFrame);
            this.followAnimationFrame = null;
        }
        
        this.cameraDirector = null;
        this.spaceshipManager = null;
        this.onShowcaseStart = null;
        this.onShowcaseEnd = null;
        this.onCameraModeChange = null;
        this.currentShowcaseSpaceships = [];
    }
}
