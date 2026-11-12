import * as THREE from 'three';
import gsap from 'gsap';

import { CAMERA_PRESETS } from './presets';

/**
 * 运镜导演系统 - 提供电影级运镜效果
 * 支持多种运镜模式：环绕、推进、拉远、特写等
 */
export default class CameraDirector {
    camera: any
    controls: any
    earth: any
    isDirecting: boolean
    currentSequence: any
    interrupted: boolean
    originalState: any
    cinematicPresets: any
    onSequenceStart: any
    onSequenceComplete: any
    onSequenceInterrupted: any
    timeline: gsap.core.Timeline | null
    returnTimeline: gsap.core.Timeline | null
    constructor(camera: any, controls: any, earth: any) {
        this.camera = camera;
        this.controls = controls;
        this.earth = earth;
        
        // 运镜状态
        this.isDirecting = false;
        this.currentSequence = null;
        this.interrupted = false;
        
        // 原始状态保存
        this.originalState = {
            position: new THREE.Vector3(),
            target: new THREE.Vector3(),
            autoRotate: false,
            enableDamping: true,
            dampingFactor: 0.05
        };
        
        this.cinematicPresets = CAMERA_PRESETS;
        
        // 事件回调
        this.onSequenceStart = null;
        this.onSequenceComplete = null;
        this.onSequenceInterrupted = null;
        this.timeline = null;
        this.returnTimeline = null;
    }
    
    /**
     * 保存当前相机状态
     */
    saveCurrentState() {
        this.originalState.position.copy(this.camera.position);
        this.originalState.target.copy(this.controls.target);
        this.originalState.autoRotate = this.controls.autoRotate;
        this.originalState.enableDamping = this.controls.enableDamping;
        this.originalState.dampingFactor = this.controls.dampingFactor;
    }
    
    /**
     * 开始运镜序列
     * @param {string} presetName - 预设名称
     * @param {Object} options - 选项
     */
  startSequence(presetName: any, options: any = {}) {
        if (this.isDirecting) {
            console.warn('Camera director is already running a sequence');
            return false;
        }
        
        const preset = this.cinematicPresets[presetName];
        if (!preset) {
            console.error(`Unknown cinematic preset: ${presetName}`);
            return false;
        }
        this.returnTimeline?.kill();
        this.returnTimeline = null;
        
        // 保存当前状态
        this.saveCurrentState();
        
        // 设置运镜状态
        this.isDirecting = true;
        this.interrupted = false;
        this.currentSequence = presetName;
        
        // 禁用用户控制和自动旋转
        this.controls.enabled = false;
        this.controls.autoRotate = false;
        
        // 修复运镜bug：禁用damping，避免controls.update()干扰GSAP动画
        // 保存原始damping状态
        this.originalState.enableDamping = this.controls.enableDamping;
        this.originalState.dampingFactor = this.controls.dampingFactor;
        this.controls.enableDamping = false; // 禁用damping，让GSAP完全控制相机
        
        // 触发开始回调
        if (this.onSequenceStart) {
            this.onSequenceStart(presetName);
        }
        
        // 执行运镜动画
        this.executeSequence(preset, options);
        
        return true;
    }
    
    /**
     * 执行运镜序列
     */
  executeSequence(preset: any, options: any) {
        const timeline = gsap.timeline({
            onComplete: () => {
                this.completeSequence();
            },
            onUpdate: () => {
                // 修复：在运镜过程中每帧确保相机朝向目标，防止偏移
                if (this.isDirecting) {
                    this.camera.lookAt(this.controls.target);
                }
            }
        });
        this.timeline = timeline;
        
        // 添加关键帧动画
        preset.keyframes.forEach((keyframe: any, index: any) => {
            if (index === 0) {
                // 第一个关键帧：从当前位置平滑过渡到预设位置
                timeline.to(this.camera.position, {
                    duration: 2.0, // 增加过渡时间，让移动更平滑
                    x: keyframe.position.x,
                    y: keyframe.position.y,
                    z: keyframe.position.z,
                    ease: "power3.inOut" // 使用更平滑的缓动函数
                }, 0);
                
                timeline.to(this.controls.target, {
                    duration: 2.0, // 增加过渡时间，让移动更平滑
                    x: keyframe.target.x,
                    y: keyframe.target.y,
                    z: keyframe.target.z,
                    ease: "power3.inOut" // 使用更平滑的缓动函数
                }, 0);
            } else {
                // 后续关键帧：添加动画
                const duration = keyframe.time - preset.keyframes[index - 1].time;
                timeline.to(this.camera.position, {
                    duration: duration,
                    x: keyframe.position.x,
                    y: keyframe.position.y,
                    z: keyframe.position.z,
                    ease: "power3.inOut" // 使用更平滑的缓动函数
                }, 2 + preset.keyframes[index - 1].time);
                
                timeline.to(this.controls.target, {
                    duration: duration,
                    x: keyframe.target.x,
                    y: keyframe.target.y,
                    z: keyframe.target.z,
                    ease: "power3.inOut" // 使用更平滑的缓动函数
                }, 2 + preset.keyframes[index - 1].time);
            }
        });
        
        // 运镜完成后，丝滑返回原始位置
        timeline.to(this.camera.position, {
            duration: 2,
            x: this.originalState.position.x,
            y: this.originalState.position.y,
            z: this.originalState.position.z,
            ease: "power2.inOut"
        }, 2 + preset.duration);
        
        timeline.to(this.controls.target, {
            duration: 2,
            x: this.originalState.target.x,
            y: this.originalState.target.y,
            z: this.originalState.target.z,
            ease: "power2.inOut"
        }, 2 + preset.duration);
    }
    
    /**
     * 更新运镜 - 在渲染循环中每帧调用，确保相机始终朝向目标
     * 修复：解决运镜过程中相机偏移问题
     */
    update() {
        if (this.isDirecting) {
            // 在运镜过程中，确保相机始终朝向目标点
            this.camera.lookAt(this.controls.target);
        }
    }
    
    /**
     * 完成运镜序列
     */
    completeSequence() {
        if (this.interrupted) return;
        this.timeline = null;
        this.isDirecting = false;
        this.currentSequence = null;
        this.restoreControls();
        
        // 触发完成回调
        if (this.onSequenceComplete) {
            this.onSequenceComplete();
        }
        
        console.log('Cinematic sequence completed');
    }
    
    /**
     * 中断运镜序列
     */
    restoreControls() {
        this.controls.enabled = true;
        this.controls.autoRotate = this.originalState.autoRotate;
        this.controls.enableDamping = this.originalState.enableDamping;
        this.controls.dampingFactor = this.originalState.dampingFactor;
        this.controls.update();
    }

    interruptSequence(returnToOriginal = true) {
        if (!this.isDirecting) return;
        
        this.interrupted = true;
        this.isDirecting = false;
        this.currentSequence = null; // 清除当前序列
        
        this.timeline?.kill();
        this.timeline = null;
        this.returnTimeline?.kill();
        this.returnTimeline = null;
        gsap.killTweensOf(this.camera.position);
        gsap.killTweensOf(this.controls.target);
        this.restoreControls();

        if (returnToOriginal) {
            this.returnTimeline = gsap.timeline({
                onUpdate: () => this.camera.lookAt(this.controls.target),
                onComplete: () => { this.returnTimeline = null; },
            })
            .to(this.camera.position, {
                x: this.originalState.position.x,
                y: this.originalState.position.y,
                z: this.originalState.position.z,
                duration: 1.5, ease: 'power2.inOut'
            }, 0)
            .to(this.controls.target, {
                x: this.originalState.target.x,
                y: this.originalState.target.y,
            z: this.originalState.target.z,
            duration: 1.5, ease: 'power2.inOut'
            }, 0);
        }

        // 触发中断回调
        if (this.onSequenceInterrupted) {
            this.onSequenceInterrupted();
        }
        
        console.log('Cinematic sequence interrupted');
    }
    
    /**
     * 停止运镜
     */
    stopSequence() {
        if (this.isDirecting) {
            this.interruptSequence();
        }
    }
    
    /**
     * 获取可用预设列表
     */
    
    /**
     * 检查是否正在运镜
     */
    isRunning() {
        return this.isDirecting;
    }
    
    /**
     * 获取当前运镜信息
     */
    
    /**
     * 添加自定义运镜预设
     */
    
    /**
     * 移除运镜预设
     */
    
    /**
     * 设置事件回调
     */
  setCallbacks(callbacks: any) {
        if (callbacks.onSequenceStart) this.onSequenceStart = callbacks.onSequenceStart;
        if (callbacks.onSequenceComplete) this.onSequenceComplete = callbacks.onSequenceComplete;
        if (callbacks.onSequenceInterrupted) this.onSequenceInterrupted = callbacks.onSequenceInterrupted;
    }
    
    /**
     * 清理资源
     */
    dispose() {
        this.interruptSequence(false);
        this.returnTimeline?.kill();
        this.returnTimeline = null;
        this.camera = null;
        this.controls = null;
        this.earth = null;
        this.onSequenceStart = null;
        this.onSequenceComplete = null;
        this.onSequenceInterrupted = null;
    }
}
