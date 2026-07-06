// @ts-nocheck
import * as THREE from 'three';
import { pane } from './system/gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { sizes, initSizes } from './system/sizes';
import { clearResizeEventListener, initResizeEventListener } from './system/resize';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer, RenderPass } from 'postprocessing';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { initEffect } from './effect';
import { arcsData, majorTradeCities } from './globe/data/arcs';
import { flightRoutes } from './globe/data/flights';
import SpaceshipManager from './globe/SpaceshipManager';
import CameraDirector from './globe/CameraDirector';
import AutoShowcaseSystem from './globe/AutoShowcaseSystem';
import PerfRecorder from './system/perf-recorder';
import LightOrbSystem from "./globe/systems/LightOrbSystem"
import CeremonySystem from "./globe/systems/CeremonySystem"
import gsap from 'gsap';

// 项目级 GSAP 默认值 + reduced-motion 支持
gsap.defaults({ overwrite: 'auto', duration: 0.6, ease: 'power2.out' })
const mm = gsap.matchMedia()
mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.defaults({ duration: 0 })
})

function initScene() {
    console.log('initScene');

    // 帧数统计器 - 可以选择移除或移动到3D场景内
    // const stats = new Stats();
    // stats.showPanel(0);
    // document.body.appendChild(stats.dom);

    const canvas = document.getElementById('webgl');
    initSizes(canvas);

    const sceneParameters = {
        bgColor: '#0f1b2e', // 默认深色主题背景
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sceneParameters.bgColor);
    scene.backgroundBlurriness = 1;
    
    // 监听主题变化事件
    const handleThemeChange = (event) => {
        const { isDark, colors } = event.detail;
        sceneParameters.bgColor = colors.background;
        scene.background = new THREE.Color(sceneParameters.bgColor);
        console.log('Theme changed:', isDark ? 'dark' : 'light', 'Background:', colors.background);
    };
    
    window.addEventListener('themeChange', handleThemeChange);
    
    const envMapUrl = '/texture/royal_esplanade_1k.hdr' // 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/royal_esplanade_1k.hdr'
    const envMap = new RGBELoader().load(envMapUrl, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.environmentIntensity = 1;
    })
    // GUI面板初始隐藏
    pane.hidden = true;

    // 按 G 键切换 GUI 面板
    window.addEventListener('keydown', (e) => {
        if (e.key === 'g' || e.key === 'G') {
            pane.hidden = !pane.hidden;
        }
    });

    // 监听设置面板按钮触发的 toggleGUI 事件
    window.addEventListener('toggleGUI', () => {
        pane.hidden = !pane.hidden;
    });

    const sceneFolder = pane.addFolder({title: 'scene'})
    sceneFolder.expanded = false
    sceneFolder.addBinding(scene, 'backgroundBlurriness', { step: 0.1, min: 0, max: 2 })
    sceneFolder.addBinding(sceneParameters, 'bgColor').on('change', ev=>{
        scene.background = new THREE.Color(ev.value);
    })
    sceneFolder.addBinding({ background: 'color'}, 'background', {
        options: { envMap: 'envMap', color: 'color'}
    }).on('change', (ev)=>{
        if (ev.value === 'envMap') scene.background = envMap;
        else scene.background = new THREE.Color(sceneParameters.bgColor);
    })

    let renderCamera = null;
    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 2000); // 增加FOV和远裁剪面
    camera.position.set(0, 0, 8); // 稍微拉远一点
    renderCamera = camera;

    const controls = new OrbitControls(renderCamera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.maxDistance = 1200; // 增加最大距离
    controls.minDistance = 20; // 设置最小距离，确保能看到完整的地球和飞船轨道
    controls.dampingFactor = 0.05; // 增加阻尼效果
    controls.autoRotateSpeed = 0.5; // 减慢自动旋转速度
    controls.autoRotate = true;
    // 设置控制器的目标为地球中心，确保相机始终对准地球
    controls.target.set(0, 0, 0);
    sceneFolder.addBinding(controls, 'autoRotate', { label: 'controls.autoRotate' })

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // 降低环境光强度
    scene.add(ambientLight);
    
    // 主光源 - 增强方向性
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.castShadow = false;
    light.position.set(-5, 3, -2); // 调整光源位置
    scene.add(light);
    
    // 添加补充光源增强深度感
    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.8); // 使用主题色
    fillLight.position.set(3, -2, 1);
    scene.add(fillLight);
    
    // 添加边缘光
    const rimLight = new THREE.DirectionalLight(0xe879f9, 0.6); // 使用主题色
    rimLight.position.set(0, 0, -5);
    scene.add(rimLight);
    
    sceneFolder.addBinding(light, 'intensity', { step: 0.1, min:0.1, max: 10, label: 'lightIntensity' });
    sceneFolder.addBinding(ambientLight, 'intensity', { step: 0.1, min:0.1, max: 5, label: 'ambientIntensity' });
    sceneFolder.addBinding(fillLight, 'intensity', { step: 0.1, min:0.1, max: 3, label: 'fillIntensity' });
    sceneFolder.addBinding(rimLight, 'intensity', { step: 0.1, min:0.1, max: 3, label: 'rimIntensity' });

    // Mac 上 antialias + alpha 会导致 FBO 分配失败，降级配置
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const renderer = new THREE.WebGLRenderer({
        canvas,
        powerPreference: isMac ? "default" : "high-performance",
        antialias: !isMac,
        alpha: !isMac,
        failIfMajorPerformanceCaveat: isMac ? false : undefined,
    })
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = false
    renderer.outputColorSpace = THREE.SRGBColorSpace // 使用sRGB色彩空间
    renderer.toneMapping = THREE.ACESFilmicToneMapping // 使用ACES色调映射
    renderer.toneMappingExposure = 1.2 // 调整曝光

    // postprocessing
    const composer = new EffectComposer(renderer, {
        multisampling: 0
    })
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    // effect
    initEffect(composer, camera)

    const perfRecorder = new PerfRecorder({
        getCamera: () => renderCamera,
        getControls: () => controls,
        getRenderer: () => renderer
    });
    let pendingPerfStopTimeout = null;

    function resetSceneSettings(){
        renderCamera = camera;
        camera.position.set(0, 0, 6);
        sceneParameters.bgColor = '#000';
        scene.background = new THREE.Color(sceneParameters.bgColor);
        ambientLight.intensity = 1;
        light.intensity = 3;
        sceneFolder.refresh();
    }

    // earth
    let earth = null;
    let spaceshipManager = null;
    let cameraDirector = null; // 运镜导演
    let autoShowcaseSystem = null;
    let ceremonySystem = null;
    let lightOrbSystem = new LightOrbSystem(scene)
    const earthTypes = {
        "earth-simple": ceateEarthSimple,
        "earth-threejs-journey": createEarthThreejsJourney,
        "earth-github": createEarthGithub
    }
    const defaultEarthType = 'earth-github';
    
    // 根据 earthTypes 动态生成 options
    const generateEarthOptions = () => {
        return Object.keys(earthTypes).map(key => ({
            text: key,
            value: key
        }));
    }

    // 异步初始化地球和运镜导演
    earthTypes[defaultEarthType]().then(() => {
        console.log('🎬 Earth and CameraDirector initialization completed');
    }).catch((error) => {
        console.error('🎬 Failed to initialize Earth and CameraDirector:', error);
    });

    const earthFolder = pane.addFolder({title: 'earth'})
    earthFolder.addBlade({
        view: 'list',
        label: 'type',
        options: generateEarthOptions(),
        value: defaultEarthType, // default
    }).on('change', (ev)=>{
        for (let i=0; i< earthFolder.children.length; i++){
            if(i!=0) {
                earthFolder.children[i]?.dispose()
                earthFolder.children[i]?.element?.remove()
            }
        }
        if(earth) {
            scene.remove(earth)
            earth.dispose()
        }
        resetSceneSettings()
        earthTypes[ev.value]()
    })

    async function ceateEarthSimple() {
        const { default: Earth } = await import('./globe/Earth-simple');
        earth = new Earth(undefined, ()=>{
            earthEnterAnimation(earth)
        })
        onEarthLoading(earth)
        scene.add(earth)
    }

    async function createEarthThreejsJourney() {
        const { default: Earth } = await import('./globe/Earth-threejs-journey');
        const earthParameters = {}
        earthParameters.atmosphereDayColor = '#00aaff'
        earthParameters.atmosphereTwilightColor = '#ffa365'
        earth = new Earth({
            atmosphereDayColor: earthParameters.atmosphereDayColor,
            atmosphereTwilightColor: earthParameters.atmosphereTwilightColor
        }, ()=>{
            earthEnterAnimation(earth)
        })
        onEarthLoading(earth)
        scene.add(earth)
        earthFolder.addBinding(earthParameters, 'atmosphereDayColor').on('change', ev=>{
            earth.earthMaterial.uniforms.uAtmosphereDayColor.value.set(earthParameters.atmosphereDayColor)
            earth.atmosphereMaterial.uniforms.uAtmosphereDayColor.value.set(earthParameters.atmosphereDayColor)
        })
        earthFolder.addBinding(earthParameters, 'atmosphereTwilightColor').on('change', ev=>{   
            earth.earthMaterial.uniforms.uAtmosphereTwilightColor.value.set(earthParameters.atmosphereTwilightColor)
            earth.atmosphereMaterial.uniforms.uAtmosphereTwilightColor.value.set(earthParameters.atmosphereTwilightColor)
        })
    }

    async function createEarthGithub() {
        try {
            const { default: Earth } = await import('./globe/Earth-github');

            // 调整相机位置：降低到飞船轨道高度，拉远距离以完整观察飞船
            // 飞船轨道高度：低轨道20，中轨道0，高轨道-20
            // 选择中轨道高度(0)作为参考，相机稍微高一点以便观察
            camera.position.set(0, 50, -400) // 从(0, 100, -280)调整为(0, 50, -400)
            sceneParameters.bgColor = '#262f4c'
            scene.background = new THREE.Color(sceneParameters.bgColor)
            light.intensity = 4
            sceneFolder.refresh()

            // 从弧线数据生成点数据
            const pointsData = [];
            
            // 添加主要贸易城市
            majorTradeCities.forEach(city => {
                const color = city.importance === 'high' ? '#58fff3' : 
                             city.importance === 'medium' ? '#eaff4e' : '#c184ff';
                pointsData.push({
                    lat: city.lat,
                    lng: city.lng,
                    color: color,
                    size: city.importance === 'high' ? 1.5 : 1,
                    name: city.name,
                    region: city.region
                });
            });
            
            // 确保弧线端点也有对应的点
            arcsData.forEach(arc => {
                // 检查起点是否已存在
                const startExists = pointsData.some(point => 
                    Math.abs(point.lat - arc.startLat) < 0.01 && 
                    Math.abs(point.lng - arc.startLng) < 0.01
                );
                if (!startExists) {
                    pointsData.push({
                        lat: arc.startLat,
                        lng: arc.startLng,
                        color: arc.color,
                        size: 1
                    });
                }
                
                // 检查终点是否已存在
                const endExists = pointsData.some(point => 
                    Math.abs(point.lat - arc.endLat) < 0.01 && 
                    Math.abs(point.lng - arc.endLng) < 0.01
                );
                if (!endExists) {
                    pointsData.push({
                        lat: arc.endLat,
                        lng: arc.endLng,
                        color: arc.color,
                        size: 1
                    });
                }
            });

            const globeConfig = {
                radius: 100,
                segments: 64,
                pointSize: 0.5,
                globeColor: '#26398c',
                showAtmosphere: true,
                atmosphereColor: '#a6e6ff',
                atmosphereAltitude: 0.05,
                emissive: '#000000',
                emissiveIntensity: 0.1,
                shininess: 100,
                polygonColor: '#7df9ff',
                polygonOpacity: 0.4,
                arcTime: 2000,
                maxRings: 1.5,
                autoRotate: true,
                autoRotateSpeed: 0.001, // 与飞船和光团同步的速度
                autoRotateDirection: 'east',
                // 飞线动画配置
                flyingLineLength: 20,
                showFlyingParticle: true,
                particleSize: 0.5,
                // 光波动画配置
                waveCount: 6,
                waveDuration: 2,
                waveDelay: 400,
                baseCircleScale: 1.0,
                ringThickness: 0.05,
                // 陆地点云配置
                showLandPoints: true,
                landPointSize: 1.0,
                landPointColor: '#9afaff',
                landPointDensity: 1.0,
                landPointOpacity: 0.8,
                // 飞机航线配置
                showFlightRoutes: true,
                flightRoutesData: flightRoutes,
                flightAnimationSpeed: 0.1,
                flightPauseTime: 2000,
                airplaneScale: 0.01,
                arcsData: arcsData,
                pointsData: pointsData,
                airplaneRotationAdjustment: 0
            };
            earth = new Earth(globeConfig, ()=>{
                earthEnterAnimation(earth)
            })
            onEarthLoading(earth)
            scene.add(earth)

            // 创建飞船管理器
            spaceshipManager = new SpaceshipManager({
                earthRadius: globeConfig.radius,
                maxShips: 20,
                deviceCapabilities: {
                    isMobile: false,
                    renderQuality: 1
                }
            });
            spaceshipManager.setReferences(camera, earth);
            scene.add(spaceshipManager);

            // 创建运镜导演
            cameraDirector = new CameraDirector(camera, controls, earth);
            console.log('🎬 CameraDirector created:', cameraDirector);
            cameraDirector.setCallbacks({
                onSequenceStart: (presetName) => {
                    console.log(`🎬 Cinematic sequence started: ${presetName}`);
                },
                onSequenceComplete: () => {
                    console.log('🎬 Cinematic sequence completed');
                },
                onSequenceInterrupted: () => {
                    console.log('🎬 Cinematic sequence interrupted');
                }
            });

            // 创建自动展示系统
            if (spaceshipManager && cameraDirector) {
                autoShowcaseSystem = new AutoShowcaseSystem(cameraDirector, spaceshipManager);
                console.log('🎭 AutoShowcaseSystem created:', autoShowcaseSystem);
                
                // 设置自动展示系统的回调
                autoShowcaseSystem.setCallbacks({
                    onShowcaseStart: (spaceships) => {
                        console.log(`🎭 Top3 showcase started for ${spaceships.length} spaceships`);
                        if (pendingPerfStopTimeout) {
                            clearTimeout(pendingPerfStopTimeout);
                            pendingPerfStopTimeout = null;
                        }
                        perfRecorder.start({
                            name: 'top3-showcase',
                            meta: {
                                shipCount: spaceships.length,
                                shipIds: spaceships.map(s => s.teamId ?? null)
                            }
                        });
                    },
                    onShowcaseEnd: () => {
                        console.log('🎭 Top3 showcase ended');
                        pendingPerfStopTimeout = setTimeout(() => {
                            perfRecorder.stop({ download: false });
                            pendingPerfStopTimeout = null;
                        }, 2600);
                    },
                    onCameraModeChange: (mode) => {
                        console.log(`🎭 Camera mode changed to: ${mode}`);
                    }
                });
                
                // 启动自动展示系统
                autoShowcaseSystem.start();
                console.log('🎭 AutoShowcaseSystem started');
            }

            // 创建光团效果
            lightOrbSystem.create();

            // 比赛结束仪式系统
            ceremonySystem = new CeremonySystem(scene, camera, controls, spaceshipManager);
            window.addEventListener('game:ended', () => {
                console.log(' Ceremony started — competition ended');
                ceremonySystem.start();
            });

            // 调试
            // 地球基本控制
            const basicFolder = earthFolder.addFolder({title: '地球基本设置'})
            // 地球颜色
            basicFolder.addBinding(globeConfig, 'globeColor').on('change', ev => {
                earth.earthMaterial.color.set(ev.value)
            })
            // 大气颜色
            basicFolder.addBinding(globeConfig, 'atmosphereColor').on('change', ev => {
                earth.atmosphere.material.uniforms.glowColor.value.set(ev.value)
            })
            basicFolder.addBinding(globeConfig, 'autoRotate')
            basicFolder.addBinding(globeConfig, 'autoRotateSpeed', {min: 0.001, max: 0.1, step: 0.001})
            basicFolder.addBinding(globeConfig, 'showAtmosphere').on('change', ev => {
                earth.atmosphere.visible = ev.value
            })
            basicFolder.addBinding(globeConfig, 'atmosphereAltitude', {min: 0.01, max: 0.3, step: 0.01}).on('change', ev => {
                // 重新创建大气层
                if (earth.atmosphere) {
                    earth.remove(earth.atmosphere)
                    earth.createAtmosphere()
                }
            })
            basicFolder.addBinding(globeConfig, 'pointSize', {min: 0.1, max: 2.0, step: 0.1}).on('change', ev => {
                // 重新创建点以应用新设置
                if (earth.pointsGroup) {
                    earth.remove(earth.pointsGroup)
                    earth.createPoints()
                }
            })
            basicFolder.addBinding(globeConfig, 'maxRings', {min: 0.5, max: 5.0, step: 0.1}).on('change', ev => {
                // 重新创建圆环以应用新设置
                if (earth.ringsGroup) {
                    earth.remove(earth.ringsGroup)
                    earth.createRings()
                }
            })
            
            // 国家边界控制
            const borderFolder = earthFolder.addFolder({title: '国家边界'})
            borderFolder.expanded = false
            
            // 边界颜色控制
            borderFolder.addBinding(globeConfig, 'polygonColor', {
                label: '边界颜色'
            }).on('change', ev => {
                if (earth.countriesGroup) {
                    earth.countriesGroup.children.forEach(child => {
                        if (child.material && child.material.color) {
                            child.material.color.set(ev.value);
                        }
                    });
                }
            });
            
            // 边界透明度控制（只影响边界线，不影响填充）
            borderFolder.addBinding(globeConfig, 'polygonOpacity', {
                min: 0.01,
                max: 1.0,
                step: 0.01,
                label: '边界透明度'
            }).on('change', ev => {
                if (earth.countriesGroup) {
                    earth.countriesGroup.children.forEach(child => {
                        // 只修改边界线的透明度，不修改填充
                        if (child.userData && child.userData.type === 'border') {
                            if (child.material && child.material.opacity !== undefined) {
                                child.material.opacity = ev.value;
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                }
            });
            
            // 显示/隐藏国家边界
            const borderVisibility = { showBorders: true };
            borderFolder.addBinding(borderVisibility, 'showBorders', {
                label: '显示边界'
            }).on('change', ev => {
                if (earth.countriesGroup) {
                    earth.countriesGroup.visible = ev.value;
                }
            });
            
            // 光波动画控制
            const waveFolder = earthFolder.addFolder({title: '光波动画'})
            waveFolder.expanded = false
            waveFolder.addBinding(globeConfig, 'waveCount', {min: 1, max: 6, step: 1}).on('change', ev => {
                // 重新创建圆环以应用新设置
                if (earth.ringsGroup) {
                    earth.remove(earth.ringsGroup)
                    earth.createRings()
                }
            })
            waveFolder.addBinding(globeConfig, 'waveDuration', {min: 1.0, max: 5.0, step: 0.1})
            waveFolder.addBinding(globeConfig, 'waveDelay', {min: 200, max: 1500, step: 50}).on('change', ev => {
                // 重新创建圆环以应用新设置
                if (earth.ringsGroup) {
                    earth.remove(earth.ringsGroup)
                    earth.createRings()
                }
            })
            waveFolder.addBinding(globeConfig, 'baseCircleScale', {min: 0.1, max: 1.5, step: 0.05}).on('change', ev => {
                // 重新创建圆环以应用新设置
                if (earth.ringsGroup) {
                    earth.remove(earth.ringsGroup)
                    earth.createRings()
                }
            })
            waveFolder.addBinding(globeConfig, 'ringThickness', {min: 0.05, max: 0.5, step: 0.01}).on('change', ev => {
                // 重新创建圆环以应用新设置
                if (earth.ringsGroup) {
                    earth.remove(earth.ringsGroup)
                    earth.createRings()
                }
            })
            
            // 飞线动画控制
            const flyingFolder = earthFolder.addFolder({title: '飞线动画'})
            flyingFolder.expanded = false
            flyingFolder.addBinding(globeConfig, 'arcTime', {min: 500, max: 4000, step: 10})
            flyingFolder.addBinding(globeConfig, 'flyingLineLength', {min: 5, max: 50, step: 1}).on('change', ev => {
                // 重新创建弧线以应用新设置
                if (earth.arcsGroup) {
                    earth.remove(earth.arcsGroup)
                    earth.createArcs()
                }
            })
            flyingFolder.addBinding(globeConfig, 'showFlyingParticle').on('change', ev => {
                // 重新创建弧线以应用新设置
                if (earth.arcsGroup) {
                    earth.remove(earth.arcsGroup)
                    earth.createArcs()
                }
            })
            flyingFolder.addBinding(globeConfig, 'particleSize', {min: 0.1, max: 2.0, step: 0.1}).on('change', ev => {
                // 重新创建弧线以应用新设置
                if (earth.arcsGroup) {
                    earth.remove(earth.arcsGroup)
                    earth.createArcs()
                }
            })

            // 陆地点云控制
            const landPointsFolder = earthFolder.addFolder({title: '陆地点云'})
            landPointsFolder.expanded = false
            
            // 显示/隐藏陆地点云
            landPointsFolder.addBinding(globeConfig, 'showLandPoints').on('change', ev => {
                earth.updateLandPointsVisibility(ev.value);
            });
            
            // 点云大小控制
            landPointsFolder.addBinding(globeConfig, 'landPointSize', {
                min: 0.1, 
                max: 3.0, 
                step: 0.1,
                label: '点大小'
            }).on('change', async (ev) => {
                if (earth.landPoints && earth.landPoints.material) {
                    earth.landPoints.material.size = ev.value;
                    earth.landPoints.material.needsUpdate = true;
                }
            });
            
            // 点云颜色控制
            landPointsFolder.addBinding(globeConfig, 'landPointColor', {
                label: '点颜色'
            }).on('change', async (ev) => {
                if (earth.landPoints && earth.landPoints.material) {
                    earth.landPoints.material.color.set(ev.value);
                    earth.landPoints.material.needsUpdate = true;
                }
            });
            
            // 点云密度控制（需要重新生成）
            landPointsFolder.addBinding(globeConfig, 'landPointDensity', {
                min: 0.5, 
                max: 3.0, 
                step: 0.1,
                label: '点密度'
            }).on('change', async (ev) => {
                // 密度改变需要重新创建点云
                if (earth.config.showLandPoints) {
                    await earth.recreateLandPoints();
                }
            });
            
            // 点云透明度控制
            landPointsFolder.addBinding(globeConfig, 'landPointOpacity', {
                min: 0.1,
                max: 1.0,
                step: 0.05,
                label: '透明度'
            }).on('change', (ev) => {
                if (earth.landPoints && earth.landPoints.material) {
                    earth.landPoints.material.opacity = ev.value;
                    earth.landPoints.material.needsUpdate = true;
                }
            });

            // 点云统计信息
            const landPointStats = { pointCount: 0 };
            landPointsFolder.addBinding(landPointStats, 'pointCount', {
                readonly: true,
                label: '点数量'
            });
            
            // 更新点云统计的函数
            const updateLandPointStats = () => {
                if (earth.landPoints && earth.landPoints.geometry) {
                    const positions = earth.landPoints.geometry.attributes.position;
                    landPointStats.pointCount = positions ? positions.count : 0;
                    landPointsFolder.refresh();
                }
            };
            
            // 重置陆地点云参数
            landPointsFolder.addButton({
                title: '重置参数'
            }).on('click', async () => {
                // 重置配置到默认值
                globeConfig.showLandPoints = true;
                globeConfig.landPointSize = 1.0;
                globeConfig.landPointColor = '#ffffff';
                globeConfig.landPointDensity = 1.0;
                globeConfig.landPointOpacity = 0.8;
                
                // 刷新控制面板
                landPointsFolder.refresh();
                
                // 重新创建陆地点云
                await earth.recreateLandPoints();
                updateLandPointStats();
            });
            
            // 强制刷新陆地点云
            landPointsFolder.addButton({
                title: '刷新点云'
            }).on('click', async () => {
                await earth.recreateLandPoints();
                updateLandPointStats();
            });
            
            // 初始统计更新
            setTimeout(updateLandPointStats, 1000);

            // 飞机航线控制
            const flightFolder = earthFolder.addFolder({title: '飞机航线'})
            flightFolder.expanded = false
            
            // 显示/隐藏飞机航线
            flightFolder.addBinding(globeConfig, 'showFlightRoutes', {
                label: '显示航线'
            }).on('change', ev => {
                if (earth.flightRoutesGroup) {
                    earth.flightRoutesGroup.visible = ev.value;
                }
            });
            
            // 飞行速度控制
            flightFolder.addBinding(globeConfig, 'flightAnimationSpeed', {
                min: 0.001,
                max: 1,
                step: 0.001,
                label: '飞行速度'
            });
            
            // 暂停时间控制
            flightFolder.addBinding(globeConfig, 'flightPauseTime', {
                min: 1000,
                max: 5000,
                step: 100,
                label: '暂停时间(ms)'
            });
            
            // 飞机大小控制
            flightFolder.addBinding(globeConfig, 'airplaneScale', {
                min: 0.05,
                max: 0.3,
                step: 0.01,
                label: '飞机大小'
            }).on('change', ev => {
                if (earth.flightRouteInstances) {
                    earth.flightRouteInstances.forEach(instance => {
                        if (instance.airplane) {
                            instance.airplane.scale.setScalar(ev.value);
                        }
                    });
                }
            });

            // 飞机朝向调整控制
            flightFolder.addBinding(globeConfig, 'airplaneRotationAdjustment', {
                min: -Math.PI,
                max: Math.PI,
                step: 0.1,
                label: '朝向调整',
                format: (v) => `${(v * 180 / Math.PI).toFixed(1)}°`
            });
            
            // 航线统计信息
            const flightStats = {
                activeRoutes: flightRoutes.length,
                totalDistance: '约45,000公里'
            };
            
            flightFolder.addBinding(flightStats, 'activeRoutes', {
                readonly: true,
                label: '活跃航线',
                format: (v) => v.toFixed(0),
            });
            
            flightFolder.addBinding(flightStats, 'totalDistance', {
                readonly: true,
                label: '总里程'
            });

            const flightOpitons = flightRoutes.map(route => {
                return {
                    text: route.name,
                    value: route.id
                }
            })
            flightOpitons.push({
                text: '默认视角',
                value: 'default'
            })
            flightFolder.addBlade({
                view: 'list',
                label: '飞行视角',
                options: flightOpitons,
                value: 'default',
            }).on('change', (ev)=>{
                if(ev.value === 'default'){
                    renderCamera = camera;
                    globeConfig.pointSize = 0.5;
                    globeConfig.showFlyingParticle = true;
                }else{
                    renderCamera = earth.flightRouteInstances.find(instance => instance.route.id === ev.value).airplane.userData.camera;
                    globeConfig.pointSize = 0.2;
                    globeConfig.showFlyingParticle = false;
                }
                // 重新创建弧线以应用新设置
                if (earth.arcsGroup) {
                    earth.remove(earth.arcsGroup)
                    earth.createArcs()
                }
                // 重新创建点以应用新设置
                if (earth.pointsGroup) {
                    earth.remove(earth.pointsGroup)
                    earth.createPoints()
                }
            })

            // 贸易数据统计
            const tradeFolder = earthFolder.addFolder({title: '贸易数据统计'})
            tradeFolder.expanded = false
            // 创建统计数据对象
            const tradeStats = {
                totalRoutes: arcsData.length,
                totalCities: majorTradeCities.length,
                highImportanceCities: majorTradeCities.filter(c => c.importance === 'high').length,
                regions: [...new Set(majorTradeCities.map(c => c.region))].length
            };
            
            // 使用 addBinding 显示只读统计信息
            tradeFolder.addBinding(tradeStats, 'totalRoutes', {
                readonly: true,
                label: '贸易路线总数'
            });
            tradeFolder.addBinding(tradeStats, 'totalCities', {
                readonly: true,
                label: '贸易城市总数'
            });
            tradeFolder.addBinding(tradeStats, 'highImportanceCities', {
                readonly: true,
                label: '重要城市数量'
            });
            tradeFolder.addBinding(tradeStats, 'regions', {
                readonly: true,
                label: '覆盖地区数'
            });

        } catch (error) {
            console.error('Error creating Earth:', error);
        }
    }

    function onEarthLoading(earth){
        document.querySelector('.loader-container').classList.remove('loaded')
        earth.visible = false
    }

    /**
     * 
     * @param {THREE.Object3D} earth 
     */
    function earthEnterAnimation(earth: any) {
        earth.visible = false
        document.querySelector('.loader-container')!.classList.add('loaded')

        const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
        tl.delay(0.5)
        tl.eventCallback('onStart', () => {
            earth.scale.set(0.01, 0.01, 0.01)
            earth.visible = true
        })

        // 缩放：极小→1.3x→回弹到 1x
        tl.to(earth.scale, { duration: 0.8, x: 1.35, y: 1.35, z: 1.35, ease: 'power3.in' }, 0)
        tl.to(earth.scale, { duration: 0.7, x: 1, y: 1, z: 1, ease: 'back.out(1.7)' }, '>-0.15')

        // 旋转：与缩放同步，用 power2.out 减速更自然
        tl.to(earth.rotation, { duration: 2.2, y: Math.PI * 6, ease: 'power2.out' }, 0)
    }

    initResizeEventListener([camera], [renderer, composer]);

    const clock = new THREE.Clock();
    let delta = 0;
    let tickId = null;
    const render = (t) => {
        const cpuStart = performance.now();
        const rawDelta = clock.getDelta();
        // 限制最大delta，防止切换标签页或卡顿时发生巨大跳跃
        delta = Math.min(rawDelta, 1/15); 

        // stats.update(); // 帧数统计已移除
        
        // 修复运镜bug：在运镜过程中跳过controls.update()，避免与GSAP动画冲突
        // 运镜过程中，controls.enabled=false，autoRotate=false，enableDamping=false
        // 所以controls.update()不需要执行，让GSAP完全控制相机位置
        const shouldSkipDirectorLookAt =
            autoShowcaseSystem &&
            autoShowcaseSystem.isShowcasing &&
            autoShowcaseSystem.shouldFollow &&
            !autoShowcaseSystem.isTransitioning;

        if (shouldSkipDirectorLookAt) {
            cameraDirector && cameraDirector.update();
        } else if (!cameraDirector || !cameraDirector.isDirecting) {
            controls.update();
        } else {
            // 修复：运镜过程中每帧更新相机朝向，确保相机始终朝向目标，防止偏移
            cameraDirector.update();
        }
        // 运镜过程中跳过controls.update()，确保GSAP动画值不会被覆盖

        earth && earth.update(delta, renderCamera);
        
        // 更新飞船管理器
        spaceshipManager && spaceshipManager.update(delta);
        
        autoShowcaseSystem && autoShowcaseSystem.update(delta);
        ceremonySystem && ceremonySystem.update(delta);

        // 更新光团动画
        lightOrbSystem.update(delta);
        
        renderer.render(scene, renderCamera);
        // composer.render();

        perfRecorder.sample({ dt: delta, cpuMs: performance.now() - cpuStart });

        tickId = requestAnimationFrame(render);
    }

    render();

    function dispose(){
        stats.dom.remove()
        clearResizeEventListener()
        cancelAnimationFrame(tickId)
        // 清理主题变化事件监听器
        window.removeEventListener('themeChange', handleThemeChange)
        scene.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose()
                child.material.dispose()
            }
        })
        // 清理飞船管理器
        spaceshipManager && spaceshipManager.dispose()
        
        // 清理运镜导演
        cameraDirector && cameraDirector.dispose()
        
        // 清理自动展示系统
        autoShowcaseSystem && autoShowcaseSystem.dispose()
        
        // 清理光团
        lightOrbSystem.orbs.forEach((orb: any) => {
            scene.remove(orb);
            orb.geometry.dispose();
            orb.material.dispose();
        });
        
        
        scene.clear()
        renderer.dispose()
        controls.dispose()
        composer.dispose()
    }

    return {
        dispose,
        getSpaceshipManager: () => spaceshipManager,
        getEarth: () => earth,
        getCamera: () => camera,
        getControls: () => controls,
        getCameraDirector: () => {
            console.log('🎬 getCameraDirector called, returning:', cameraDirector);
            return cameraDirector;
        },
        getAutoShowcaseSystem: () => {
            console.log('🎭 getAutoShowcaseSystem called, returning:', autoShowcaseSystem);
            return autoShowcaseSystem;
        }
    }
}

export { initScene };
