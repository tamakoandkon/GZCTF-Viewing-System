// @ts-nocheck
import * as THREE from 'three';
import earcut from 'earcut';

import atmosphereFragmentShader from './shader/simple-earth/atmosphere.fs';
import atmosphereVertexShader from './shader/simple-earth/atmosphere.vs';

import countries from './data/globe.json';

// 修复：使用同步导入避免top-level await问题
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { sizes } from '../system/sizes';
import ArcSystem from "./systems/ArcSystem"

// 修复：安全初始化GLTFLoader和DRACOLoader
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();

if (gltfLoader && dracoLoader) {
    // 修复：支持多个Draco解码器路径
    const dracoPaths = ['/draco/', './draco/', 'draco/'];
    let dracoPathIndex = 0;
    
    const trySetDracoPath = () => {
        if (dracoPathIndex < dracoPaths.length) {
            dracoLoader.setDecoderPath(dracoPaths[dracoPathIndex]);
            console.log(`Trying Draco decoder path: ${dracoPaths[dracoPathIndex]}`);
            gltfLoader.setDRACOLoader(dracoLoader);
        } else {
            console.warn('All Draco decoder paths failed, GLTF models may not load properly');
        }
    };
    
    trySetDracoPath();
} else {
    console.warn('GLTFLoader or DRACOLoader not available, airplane models will not be supported');
}

export default class Earth extends THREE.Object3D {
    /**
     * EarthGlobe - 3D地球
     * @param {{
     *   radius?: number,
     *   segments?: number,
     *   pointSize?: number,
     *   globeColor?: string,
     *   showAtmosphere?: boolean,
     *   atmosphereColor?: string,
     *   atmosphereAltitude?: number,
     *   emissive?: string,
     *   emissiveIntensity?: number,
     *   shininess?: number,
     *   polygonColor?: string,
     *   polygonOpacity?: number,
     *   arcTime?: number,
     *   maxRings?: number,
     *   autoRotate?: boolean,
     *   autoRotateSpeed?: number,
     *   flyingLineLength?: number,
     *   showFlyingParticle?: boolean,
     *   particleSize?: number,
     *   waveCount?: number,
     *   waveDuration?: number,
     *   waveDelay?: number,
     *   baseCircleScale?: number,
     *   ringThickness?: number,
     *   countriesData?: any,
     *   arcsData?: any[],
     *   pointsData?: any[],
     *   showLandPoints?: boolean,
     *   landPointSize?: number,
     *   landPointColor?: string,
     *   landPointDensity?: number,
     *   landPointOpacity?: number,
     *   showFlightRoutes?: boolean,
     *   flightRoutesData?: any[],
     *   flightAnimationSpeed?: number,
     *   flightPauseTime?: number,
     *   airplaneScale?: number,
     *   airplaneRotationAdjustment?: number,
     * }} config 
     * @param {Function} onLoad - 加载完成回调函数
     */
    constructor(config = {}, onLoad = () => {}) {
        super();
        
        const {
            radius = 100,
            segments = 64,
            pointSize = 1,
            globeColor = '#1d072e',
            showAtmosphere = true,
            atmosphereColor = '#ffffff',
            atmosphereAltitude = 0.1,
            emissive = '#000000',
            emissiveIntensity = 0.1,
            shininess = 50,
            polygonColor = '#ffffff',
            polygonOpacity = 0.05,
            arcTime = 2000,
            maxRings = 3,
            autoRotate = true,
            autoRotateSpeed = 0.01,
            autoRotateDirection = 'west', // 修复：添加默认值
            flyingLineLength = 20,
            showFlyingParticle = true,
            particleSize = 0.5,
            waveCount = 3,
            waveDuration = 2.5,
            waveDelay = 800,
            baseCircleScale = 0.3,
            ringThickness = 0.15,
            countriesData = countries,
            arcsData = [],
            pointsData = [],
            showLandPoints = true,
            landPointSize = 1.0,
            landPointColor = '#ffffff',
            landPointDensity = 1.0,
            landPointOpacity = 0.8,
            showFlightRoutes = false,
            flightRoutesData = [],
            flightAnimationSpeed = 0.01,
            flightPauseTime = 2000,
            airplaneScale = 0.01,
            airplaneRotationAdjustment = 0,
        } = config;

        this.name = 'EarthGlobe';
        this.radius = radius;
        this.segments = segments;
        
        // 修复：简化配置合并逻辑，避免重复设置
        this.config = {
            radius,
            segments,
            pointSize,
            globeColor,
            showAtmosphere,
            atmosphereColor,
            atmosphereAltitude,
            emissive,
            emissiveIntensity,
            shininess,
            polygonColor,
            polygonOpacity,
            arcTime,
            maxRings,
            autoRotate,
            autoRotateSpeed,
            autoRotateDirection,
            flyingLineLength,
            showFlyingParticle,
            particleSize,
            waveCount,
            waveDuration,
            waveDelay,
            baseCircleScale,
            ringThickness,
            countriesData,
            arcsData,
            pointsData,
            showLandPoints,
            landPointSize,
            landPointColor,
            landPointDensity,
            landPointOpacity,
            showFlightRoutes,
            flightRoutesData,
            flightAnimationSpeed,
            flightPauseTime,
            airplaneScale,
            airplaneRotationAdjustment,
            ...config // 用户配置覆盖默认值
        };

        // 国家高亮相关属性
        this.highlightedCountries = new Map(); // 存储高亮的国家
        this.countryMaterials = new Map(); // 存储国家材质
        this.laserAttacks = []; // 存储激光攻击
        this.explosionEffects = []; // 存储爆炸特效
        this.countryLabels = new Map(); // 存储国家标签
        
        // 调试信息
        console.log('Earth constructor initialized with highlight support');

        this.hasLoaded = false;
        this.onLoad = ()=>{
            if(!this.hasLoaded){
                onLoad()
                this.hasLoaded = true
            }
        };

        this.airplaneModel = new THREE.Object3D();
        this.airplaneCamera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 10000);

        // 数据存储
        this.countriesData = countriesData;
        this.arcsData = arcsData;
        this.pointsData = pointsData;
        this.flightRoutesData = this.config.flightRoutesData || [];

        // 动画相关
        this.time = 0;
        
        // 弧线更新相关变量
        this.arcUpdateIndex = 0;

        // 材质复用管理器
        this.materialManager = this.createMaterialManager();

        // 缓存变量
        this.animationCache = {
            tempVector: new THREE.Vector3(),
            tempColor: new THREE.Color(),
        };

        // 修复：添加初始化错误处理
        try {
        this.arcSystem = new ArcSystem(this)
            this.initializeComponents();
        } catch (error) {
            console.error('Error initializing Earth components:', error);
            // 即使初始化失败，也尝试设置基本功能
            this.createEarth();
            if (this.config.showAtmosphere) {
                this.createAtmosphere();
            }
        }

        // 修复事件监听器内存泄漏：保存绑定后的函数引用
        this.boundResizeHandler = this.onWindowResize.bind(this);
        window.addEventListener('resize', this.boundResizeHandler);
    }

    /**
     * 创建动态环形材质 - 支持运行时透明度控制
     */
    createDynamicRingMaterial(color) {
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform vec3 color;
            uniform float opacity;
            varying vec2 vUv;
            void main() {
                gl_FragColor = vec4(color, opacity);
            }
        `;
        
        return new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                opacity: { value: 0.8 }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false
        });
    }

    /**
     * 创建材质管理器，复用相同或相似的材质
     */
    createMaterialManager() {
        const manager = {
            // 基础材质缓存
            materials: new Map(),
            
            // 获取或创建线材质
            getLineMaterial: (color, opacity = 1, transparent = false) => {
                const key = `line_${color}_${opacity}_${transparent}`;
                if (!manager.materials.has(key)) {
                    manager.materials.set(key, new THREE.LineBasicMaterial({
                        color: new THREE.Color(color),
                        transparent,
                        opacity,
                        vertexColors: false,
                        depthTest: true,
                        depthWrite: false
                    }));
                }
                return manager.materials.get(key);
            },

            // 获取或创建点材质
            getPointMaterial: (color, size = 1, transparent = false, opacity = 1) => {
                const key = `point_${color}_${size}_${transparent}_${opacity}`;
                if (!manager.materials.has(key)) {
                    manager.materials.set(key, new THREE.MeshBasicMaterial({
                        color: new THREE.Color(color),
                        transparent,
                        opacity,
                        depthWrite: false
                    }));
                }
                return manager.materials.get(key);
            },

            // 获取或创建环形材质
            getRingMaterial: (color, opacity = 1, side = THREE.DoubleSide) => {
                const key = `ring_${color}_${opacity}_${side}`;
                if (!manager.materials.has(key)) {
                    manager.materials.set(key, new THREE.MeshBasicMaterial({
                        color: new THREE.Color(color),
                        transparent: true,
                        opacity,
                        side,
                        depthTest: true,
                        depthWrite: false
                    }));
                }
                return manager.materials.get(key);
            },

            // 获取或创建圆形材质
            getCircleMaterial: (color, opacity = 1, side = THREE.DoubleSide) => {
                const key = `circle_${color}_${opacity}_${side}`;
                if (!manager.materials.has(key)) {
                    manager.materials.set(key, new THREE.MeshBasicMaterial({
                        color: new THREE.Color(color),
                        transparent: true,
                        opacity,
                        side,
                        depthWrite: false
                    }));
                }
                return manager.materials.get(key);
            },

            // 获取或创建飞线材质（支持顶点颜色）
            getFlyingLineMaterial: (color, vertexColors = true) => {
                const key = `flying_${color}_${vertexColors}`;
                if (!manager.materials.has(key)) {
                    manager.materials.set(key, new THREE.LineBasicMaterial({
                        color: new THREE.Color(color),
                        vertexColors: vertexColors,
                        depthWrite: false
                    }));
                }
                return manager.materials.get(key);
            },

            // 清理材质
            dispose: () => {
                manager.materials.forEach(material => {
                    if (material.dispose) material.dispose();
                });
                manager.materials.clear();
            }
        };

        return manager;
    }

    initializeComponents() {
        // 创建地球几何体和材质
        this.createEarth();
        
        // 创建大气层
        if (this.config.showAtmosphere) {
            this.createAtmosphere();
        }

        // 创建国家边界
        if (this.countriesData) {
            this.createCountries();
        }

        // 创建弧线
        if (this.arcsData.length > 0) {
            this.createArcs();
        }

        // 创建点
        if (this.pointsData.length > 0) {
            this.createPoints();
        }

        // 创建环形动画
        this.createRings();

        // 创建基于纹理的陆地点云
        if (this.config.showLandPoints) {
            this.createLandPoints();
        }

        // 创建飞机航线
        if (this.config.showFlightRoutes && this.flightRoutesData.length > 0) {
            this.createFlightRoutes().then(() => {
                // 如果没有陆地点云，在飞机航线创建完成后调用onLoad
                if (!this.config.showLandPoints) {
                this.onLoad();
                }
            });
        } else if (!this.config.showLandPoints) {
            // 如果既没有陆地点云也没有飞机航线，直接调用onLoad
            this.onLoad();
        }
    }

    createEarth() {
        this.earthGeometry = new THREE.SphereGeometry(this.radius, this.segments, this.segments);
        
        this.earthMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(this.config.globeColor),
            emissive: new THREE.Color(this.config.emissive),
            emissiveIntensity: this.config.emissiveIntensity,
            shininess: this.config.shininess,
            depthWrite: true
        });

        this.earthMesh = new THREE.Mesh(this.earthGeometry, this.earthMaterial);
        this.add(this.earthMesh);
    }

    createAtmosphere() {
        const atmosphereGeometry = new THREE.SphereGeometry(
            this.radius * (1 + this.config.atmosphereAltitude), 
            this.segments, 
            this.segments
        );

        const atmosphereMaterial = new THREE.ShaderMaterial({
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            uniforms: {
                glowColor: { value: new THREE.Color(this.config.atmosphereColor), },
            },
            vertexShader: atmosphereVertexShader,
            fragmentShader: atmosphereFragmentShader,
        });

        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.add(this.atmosphere);
    }

    createCountries() {
        if (!this.countriesData || !this.countriesData.features) return;

        console.log('Creating countries with', this.countriesData.features.length, 'features');

        this.countriesGroup = new THREE.Group();
        this.countriesGroup.name = 'Countries';

        // 为边界线创建独立材质
        const borderMaterial = this.materialManager.getLineMaterial(
            this.config.polygonColor, 
            this.config.polygonOpacity, 
            true
        );

        // 为填充创建独立材质（颜色和透明度独立）
        const fillColor = this.config.polygonColor;
        const fillOpacity = 0.1; // 填充的透明度固定为0.1，不受边界线影响

        // 精选大国列表（只对这些国家进行填充）
        const fillCountries = [
            // 南美洲大国
            "Brazil", "Colombia", "Venezuela", "Peru", "Bolivia",
            // 北美洲大国
            "Mexico", "Greenland",
            // 亚洲大国
            "India", "Kazakhstan", "Saudi Arabia", "Iran", "Mongolia",
            "Myanmar", "Afghanistan", "Pakistan", "Thailand",
            "Turkmenistan", "Uzbekistan",
            // 非洲大国
            "Democratic Republic of the Congo", "Sudan", "Mozambique", 
            "Mali", "Algeria", "Libya", "Niger", "Chad", "Ethiopia",
            "Guinea", "Morocco", "South Sudan", "Central African Republic",
            "Cameroon", "Zambia", "Nigeria", "Republic of Congo",
            "Madagascar", "United Republic of Tanzania", "Ivory Coast",
            // 欧洲大国
            "Ukraine", "Germany", "Spain", "Republic of Serbia",
            // 中美洲
            "Honduras", "Nicaragua", "Panama"
        ];

        let borderCount = 0;
        let fillCount = 0;

        this.countriesData.features.forEach(feature => {
            const countryName = this.extractCountryName(feature);
            
            // 所有国家都绘制边界线
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                // 判断是否需要填充
                const shouldFill = fillCountries.includes(countryName) || 
                                 fillCountries.includes(feature.properties?.admin);
                
                if (shouldFill && feature.geometry.type === 'Polygon') {
                    // 只对精选的Polygon国家进行填充
                    const hasHoles = feature.geometry.coordinates.length > 1;
                    if (!hasHoles) {
                        this.createCountryPolygon(feature, borderMaterial, fillColor, fillOpacity);
                        fillCount++;
                        console.log(`✓ ${countryName} (filled)`);
                    } else {
                        // 有洞的只画边界
                        this.createCountryBorderOnly(feature, borderMaterial);
                        borderCount++;
                        console.log(`○ ${countryName} (border only, has holes)`);
                    }
                } else {
                    // 其他国家只画边界线
                    this.createCountryBorderOnly(feature, borderMaterial);
                    borderCount++;
                    console.log(`○ ${countryName} (border only)`);
                }
            }
        });

        console.log(`✅ Countries: ${fillCount} filled, ${borderCount} border-only`);
        console.log(`📊 Total elements in scene: ${this.countriesGroup.children.length}`);

        this.add(this.countriesGroup);
    }

    createCountryPolygon(feature, borderMaterial, fillColor, fillOpacity) {
        // 修复：改进国家名称提取逻辑，支持更多属性字段
        const countryName = this.extractCountryName(feature);
        
        // 处理Polygon和MultiPolygon
        let polygons = [];
        if (feature.geometry.type === 'Polygon') {
            polygons = [feature.geometry.coordinates];
        } else if (feature.geometry.type === 'MultiPolygon') {
            polygons = feature.geometry.coordinates;
        } else {
            console.warn(`Unsupported geometry type: ${feature.geometry.type} for country ${countryName}`);
            return;
        }
        console.log(`Processing ${polygons.length} polygons for ${countryName}`);
        
        polygons.forEach(polygonGroup => {
            this.processPolygonGroup(polygonGroup, countryName, borderMaterial, fillColor, fillOpacity);
        });
    }

    /**
     * 只创建国家边界线，不填充（用于MultiPolygon或有洞的国家）
     */
    createCountryBorderOnly(feature, material) {
        const countryName = this.extractCountryName(feature);
        
        // 处理Polygon和MultiPolygon
        let polygons = [];
        if (feature.geometry.type === 'Polygon') {
            polygons = [feature.geometry.coordinates];
        } else if (feature.geometry.type === 'MultiPolygon') {
            polygons = feature.geometry.coordinates;
        } else {
            return;
        }

        // 只绘制外环边界线，不创建填充
        polygons.forEach(polygonGroup => {
            if (!polygonGroup || polygonGroup.length === 0) return;
            
            // 只处理外环
            const outerRing = polygonGroup[0];
            if (outerRing.length >= 3) {
                this.createPolygonRing(outerRing, countryName, material, 'outer');
            }
            
            // 也绘制内环（洞的边界）
            const innerRings = polygonGroup.slice(1);
            innerRings.forEach(innerRing => {
                if (innerRing.length >= 3) {
                    this.createPolygonRing(innerRing, countryName, material, 'inner');
                }
            });
        });
    }

    createArcs() {
        this.arcsGroup = new THREE.Group();
        this.arcsGroup.name = 'Arcs';

        this.arcsData.forEach((arc, index) => {
            this.createArc(arc, index);
        });

        this.add(this.arcsGroup);
    }

    createArc(arc, index) {
        const startPos = this.latLngToVector3(arc.startLat, arc.startLng, this.radius);
        const endPos = this.latLngToVector3(arc.endLat, arc.endLng, this.radius);
        
        // 计算两点间的角度和弧线
        const angle = startPos.angleTo(endPos);
        // 修复：使用空值合并运算符正确处理arcAlt为0的情况
        const arcHeight = this.radius * (arc.arcAlt ?? 0.1);
        const angleThreshold = Math.PI / 3; // 60度
        
        // 根据角度选择曲线类型
        const curve = this.createCurve(startPos, endPos, angle, arcHeight, angleThreshold);
        const points = curve.getPoints(100);
        
        // 创建弧线组
        const arcGroup = new THREE.Group();
        
        // 创建静态弧线（背景轨迹）
        const staticGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const staticMaterial = this.materialManager.getLineMaterial(
            arc.color || '#ffffff', 
            0.2, 
            true
        );
        const staticLine = new THREE.Line(staticGeometry, staticMaterial);
        staticLine.renderOrder = 4;
        arcGroup.add(staticLine);
        
        // 创建动画飞线
        const flyingGeometry = new THREE.BufferGeometry();
        const flyingMaterial = this.materialManager.getFlyingLineMaterial(arc.color || '#ffffff');
        const flyingLine = new THREE.Line(flyingGeometry, flyingMaterial);
        flyingLine.renderOrder = 5;
        arcGroup.add(flyingLine);
        
        // 创建飞行粒子（可选）
        let particle = null;
        if (this.config.showFlyingParticle) {
            particle = this.createParticle(arc.color);
            arcGroup.add(particle);
        }
        
        arcGroup.userData = { 
            arc, 
            index,
            points,
            flyingGeometry,
            particle,
            animationOffset: index * (this.config.arcTime / this.arcsData.length),
            flyingLength: this.config.flyingLineLength,
            // 性能优化：缓存计算结果
            totalPoints: points.length,
            pointsPerProgress: points.length - 2,
            // 性能优化：预分配缓冲区
            positionBuffer: new Float32Array(this.config.flyingLineLength * 3),
            colorBuffer: new Float32Array(this.config.flyingLineLength * 3),
            lastVisibleCount: 0
        };
        
        this.arcsGroup.add(arcGroup);
    }

    createCurve(startPos, endPos, angle, arcHeight, angleThreshold) {
        // 修复：确保arcHeight是有效数值
        const safeArcHeight = (arcHeight != null && !isNaN(arcHeight)) ? arcHeight : 0.1;
        
        if (angle > angleThreshold) {
            // 三次贝塞尔曲线
            const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
            midPoint.normalize().multiplyScalar(this.radius + safeArcHeight);
            
            const controlPoint1 = new THREE.Vector3().lerpVectors(startPos, midPoint, 0.5);
            controlPoint1.normalize().multiplyScalar(this.radius + safeArcHeight);
            
            const controlPoint2 = new THREE.Vector3().lerpVectors(midPoint, endPos, 0.5);
            controlPoint2.normalize().multiplyScalar(this.radius + safeArcHeight);
            
            return new THREE.CubicBezierCurve3(startPos, controlPoint1, controlPoint2, endPos);
        } else {
            // 二次贝塞尔曲线
            const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
            midPoint.normalize().multiplyScalar(this.radius + safeArcHeight);
            
            return new THREE.QuadraticBezierCurve3(startPos, midPoint, endPos);
        }
    }

    createParticle(color) {
        const geometry = new THREE.SphereGeometry(this.config.particleSize, 8, 8);
        
        const material = this.materialManager.getPointMaterial(
            color || '#ffffff',
            this.config.particleSize,
            true,
            0.8
        );
        return new THREE.Mesh(geometry, material);
    }

    createPoints() {
        this.pointsGroup = new THREE.Group();
        this.pointsGroup.name = 'Points';

        // 去重处理
        const uniquePoints = this.removeDuplicatePoints(this.pointsData);

        // 为不同颜色的点预创建材质
        const pointMaterials = new Map();

        const geometry = new THREE.SphereGeometry(this.config.pointSize);

        uniquePoints.forEach(point => {
            this.createPoint(point, geometry, pointMaterials);
        });

        this.add(this.pointsGroup);
    }

    createPoint(point, geometry, pointMaterials) {
        const position = this.latLngToVector3(point.lat, point.lng, this.radius + 0.5);
        
        const color = point.color || '#ffffff';
        if (!pointMaterials.has(color)) {
            pointMaterials.set(color, this.materialManager.getPointMaterial(color));
        }
        const material = pointMaterials.get(color);

        const pointMesh = new THREE.Mesh(geometry, material);
        pointMesh.position.copy(position);
        
        this.pointsGroup.add(pointMesh);
    }

    createRings() {
        this.ringsGroup = new THREE.Group();
        this.ringsGroup.name = 'Rings';
        
        // 为圆环预创建几何体和材质
        this.ringGeometries = {
            baseCircle: new THREE.CircleGeometry(this.config.maxRings * this.config.baseCircleScale),
            waveRing: new THREE.RingGeometry(
                this.config.maxRings * this.config.baseCircleScale + this.config.maxRings * 0.1,
                this.config.maxRings * this.config.baseCircleScale + this.config.maxRings * 0.1 + this.config.maxRings * this.config.ringThickness,
                32
            )
        };
        
        // 修复：为环形预创建材质，使用ShaderMaterial支持动态透明度
        this.ringMaterials = {
            baseCircle: this.materialManager.getCircleMaterial('#ffffff', 0.9, THREE.DoubleSide),
            waveRing: this.createDynamicRingMaterial('#ffffff') // 使用动态材质
        };
        
        // 为每个点创建圆环组
        if (this.pointsData && this.pointsData.length > 0) {
            this.pointsData.forEach((point, index) => {
                this.createRingForPoint(point, index);
            });
        }
        
        this.add(this.ringsGroup);
    }

    createRingForPoint(point, pointIndex) {
        const position = this.latLngToVector3(point.lat, point.lng, this.radius + 0.1);
        
        // 创建圆环组
        const ringGroup = new THREE.Group();
        ringGroup.position.copy(position);
        ringGroup.lookAt(new THREE.Vector3(0, 0, 0));
        
        // 创建底圆
        const baseCircle = this.createBaseCircle(point);
        ringGroup.add(baseCircle);
        
        // 创建波浪圆环
        const waves = this.createWaveRings();
        ringGroup.add(...waves)
        
        ringGroup.userData = { 
            waves,
            baseCircle,
            point,
            pointIndex,
            startTime: 0
        };

        this.ringsGroup.add(ringGroup);
    }

    createBaseCircle(point) {
        const geometry = this.ringGeometries.baseCircle;
        
        // 如果点有自定义颜色，创建对应材质，否则使用默认材质
        const color = point.color || this.config.polygonColor;
        const material = this.materialManager.getCircleMaterial(color, 0.9, THREE.DoubleSide);
        
        const baseCircle = new THREE.Mesh(geometry, material);
        baseCircle.name = 'baseCircle';
        baseCircle.renderOrder = 2;
        return baseCircle;
    }

    createWaveRings() {
        const waves = [];
        
        for (let i = 0; i < this.config.waveCount; i++) {
            const geometry = this.ringGeometries.waveRing;
            // 修复：为每个波浪创建独立的ShaderMaterial实例，但共享uniforms
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    color: { value: new THREE.Color('#ffffff') },
                    opacity: { value: 1.0 - (i * 0.1) }
                },
                vertexShader: this.ringMaterials.waveRing.vertexShader,
                fragmentShader: this.ringMaterials.waveRing.fragmentShader,
                transparent: true,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: false
            });
            
            const wave = new THREE.Mesh(geometry, material);
            wave.renderOrder = 3;
            wave.userData = {
                waveIndex: i,
                maxScale: 1.5,
                initialOpacity: 1.0 - (i * 0.1),
                initialScale: 0.1,
                animationOffset: i * (this.config.waveDelay / 1000),
                material: material // 保存材质引用以便后续更新
            };
            
            waves.push(wave);
        }
        
        return waves;
    }

    /**
     * 处理多边形组 - 简化版本，只处理外环
     */
    processPolygonGroup(polygonGroup, countryName, borderMaterial, fillColor, fillOpacity) {
        if (!polygonGroup || polygonGroup.length === 0) return;
        
        // 只处理外环，忽略内环（洞）
        const outerRing = polygonGroup[0];
        
        if (outerRing.length < 3) return;
        
        // 创建外环边界线（使用边界材质）
        this.createPolygonRing(outerRing, countryName, borderMaterial, 'outer');
        
        // 创建填充网格（使用独立的填充颜色和透明度）
        this.createPolygonFill(outerRing, countryName, fillColor, fillOpacity);
    }
    
    /**
     * 创建多边形环（边界线）
     */
    createPolygonRing(ring, countryName, material, ringType) {
        const points = ring.map(coord => {
            const [lng, lat] = coord;
            return this.latLngToVector3(lat, lng, this.radius + 0.1);
        });

        // 创建线条用于边界
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeometry, material);
        line.renderOrder = 1;
        line.userData = { 
            countryName, 
            type: 'border', 
            ringType: ringType,
            standardName: this.getCountryStandardName(countryName)
        };
        this.countriesGroup.add(line);
    }
    
    /**
     * 创建多边形填充（简化版本，只处理外环）
     */
    createPolygonFill(outerRing, countryName, fillColor, fillOpacity) {
        try {
            // 将多边形投影到2D平面进行三角剖分
            const outerRing2D = [];
            const outerPoints3D = [];
            
            // 计算多边形的中心点和法向量
            const center = new THREE.Vector3();
            outerRing.forEach(coord => {
                const [lng, lat] = coord;
                const point = this.latLngToVector3(lat, lng, this.radius + 0.1);
                center.add(point);
            });
            center.divideScalar(outerRing.length);
            const normal = center.clone().normalize();
            
            // 创建从3D到2D的投影基向量
            const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
            const tangent = new THREE.Vector3().crossVectors(normal, up).normalize();
            const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
            
            // 将外环投影到2D并保存3D坐标
            outerRing.forEach(coord => {
                const [lng, lat] = coord;
                const point3D = this.latLngToVector3(lat, lng, this.radius + 1.0);
                outerPoints3D.push(point3D);
                
                // 投影到2D
                const relative = point3D.clone().sub(center);
                const x = relative.dot(tangent);
                const y = relative.dot(bitangent);
                outerRing2D.push(x, y);
            });
            
            // 使用Earcut进行三角剖分（不传入holes，完全填充）
            const indices = earcut(outerRing2D);
            
            if (!indices || indices.length === 0) {
                console.warn(`Earcut failed for ${countryName}, using fallback triangulation`);
                // 降级到扇形剖分
                const fallbackIndices = [];
                for (let i = 1; i < outerPoints3D.length - 1; i++) {
                    fallbackIndices.push(0, i, i + 1);
                }
                this.createFillMesh(outerPoints3D, fallbackIndices, countryName, fillColor, fillOpacity);
                return;
            }
            
            // 创建3D填充网格
            this.createFillMesh(outerPoints3D, indices, countryName, fillColor, fillOpacity);
            
        } catch (error) {
            console.warn(`Failed to create 3D fill mesh for ${countryName}:`, error);
        }
    }
    
    /**
     * 创建填充网格（使用独立的填充颜色和透明度）
     */
    createFillMesh(points3D, indices, countryName, fillColor, fillOpacity) {
        const vertices = [];
        points3D.forEach(point => {
            vertices.push(point.x, point.y, point.z);
        });
        
        const fillGeometry = new THREE.BufferGeometry();
        fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        fillGeometry.setIndex(indices);
        fillGeometry.computeVertexNormals();
        
        // 创建独立的填充材质（不受边界线材质影响）
        const fillMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(fillColor),
            transparent: true,
            opacity: fillOpacity, // 使用独立的填充透明度
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false // 关键：关闭深度写入，避免被地球遮挡
        });
        
        const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
        fillMesh.renderOrder = 0;
        fillMesh.userData = { 
            countryName, 
            type: 'fill',
            standardName: this.getCountryStandardName(countryName)
        };
        this.countriesGroup.add(fillMesh);
    }


    /**
     * 提取国家名称 - 支持多种属性字段和名称映射
     */
    extractCountryName(feature) {
        const properties = feature.properties || {};
        
        // 优先级顺序：name_en, name, NAME, admin, ADMIN, NAME_EN, NAME_ZH等
        const nameFields = [
            'name_en', 'name', 'NAME', 'admin', 'ADMIN', 
            'NAME_EN', 'NAME_ZH', 'name_zh', 'NAME_CN', 'name_cn',
            'country', 'COUNTRY', 'country_name', 'COUNTRY_NAME'
        ];
        
        for (const field of nameFields) {
            if (properties[field] && typeof properties[field] === 'string') {
                return properties[field].trim();
            }
        }
        
        // 如果所有字段都没有，返回Unknown
        return 'Unknown';
    }

    /**
     * 国家名称标准化映射 - 将各种名称变体映射到标准名称
     */
    getCountryStandardName(countryName) {
        const nameMapping = {
            // 中国相关
            'China': ['China', '中华人民共和国', 'People\'s Republic of China', 'CHN', 'CN'],
            // 美国相关
            'United States': ['United States', 'USA', 'US', 'United States of America', 'America'],
            // 俄罗斯相关
            'Russia': ['Russia', 'Russian Federation', 'Россия', 'RUS', 'RU'],
            // 德国相关
            'Germany': ['Germany', 'Deutschland', 'Federal Republic of Germany', 'DEU', 'DE'],
            // 日本相关
            'Japan': ['Japan', '日本', 'Nippon', 'JPN', 'JP'],
            // 韩国相关
            'South Korea': ['South Korea', 'Korea', '대한민국', 'Republic of Korea', 'KOR', 'KR'],
            // 英国相关
            'United Kingdom': ['United Kingdom', 'UK', 'Great Britain', 'Britain', 'England', 'GBR', 'GB'],
            // 法国相关
            'France': ['France', 'French Republic', 'République française', 'FRA', 'FR'],
            // 加拿大相关
            'Canada': ['Canada', 'CAN', 'CA'],
            // 澳大利亚相关
            'Australia': ['Australia', 'Commonwealth of Australia', 'AUS', 'AU'],
            // 印度相关
            'India': ['India', 'भारत', 'Republic of India', 'IND', 'IN'],
            // 瑞士相关
            'Switzerland': ['Switzerland', 'Swiss Confederation', 'Schweiz', 'CHE', 'CH'],
            // 荷兰相关
            'Netherlands': ['Netherlands', 'Holland', 'Kingdom of the Netherlands', 'NLD', 'NL'],
            // 马来西亚相关
            'Malaysia': ['Malaysia', 'Malaysia', 'MYS', 'MY']
        };
        
        // 查找匹配的标准名称
        for (const [standardName, variants] of Object.entries(nameMapping)) {
            if (variants.includes(countryName)) {
                return standardName;
            }
        }
        
        // 如果没有找到匹配，返回原始名称
        return countryName;
    }

    // 工具方法
    latLngToVector3(lat, lng, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);

        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);

        return new THREE.Vector3(x, y, z);
    }

    removeDuplicatePoints(points) {
        const seen = new Set();
        return points.filter(point => {
            const key = `${point.lat},${point.lng}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // 动画更新方法 - 修复：添加错误边界处理
    update(delta, camera = null) {
        try {
            this.time += delta;

            // 自动旋转
            if (this.config.autoRotate) {
                const rotateSpeed = this.config.autoRotateDirection === 'east' 
                ? this.config.autoRotateSpeed 
                : -this.config.autoRotateSpeed;
                this.rotation.y += delta * rotateSpeed;
            }

            // 批量更新环形动画
            this.updateRingsAnimationBatch(this.time);

            // 批量更新弧线动画
            this.updateArcsAnimationBatch(this.time);

            // 更新飞机航线动画
            if (this.config.showFlightRoutes) {
                this.updateFlightRoutesAnimation(this.time * 1000); // 转换为毫秒
            }

            // 更新飞机相机的平滑跟随
            this.updateFlightCameraSmooth(delta);

            // 更新爆炸特效
            this.updateExplosionEffects(delta);

            // 更新国家标签朝向
            if (camera) {
                this.updateLabels(camera);
            }
        } catch (error) {
            console.error('Error in Earth update method:', error);
            // 错误恢复：重置可能导致问题的状态
            this.time = this.time || 0;
            this.rotation.y = this.rotation.y || 0;
        }
    }

    /**
     * 批量更新环形动画，减少重复计算
     */
    updateRingsAnimationBatch(currentTime) {
        if (!this.ringsGroup || this.ringsGroup.children.length === 0) return;

        this.ringsGroup.children.forEach(ringGroup => {
            const userData = ringGroup.userData;
            if (!userData || !userData.waves) return;
            
            // 初始化startTime
            if (userData.startTime === 0) {
                userData.startTime = currentTime;
            }
            
            const groupElapsed = currentTime - userData.startTime;
            
            // 更新底圆的脉冲效果 - 使用预计算值
            if (userData.baseCircle) {
                const pulseScale = 1 + 0.15 * Math.sin(currentTime * 4);
                const pulseOpacity = 0.5 + 0.3 * Math.sin(currentTime * 2);
                userData.baseCircle.scale.setScalar(pulseScale);
                userData.baseCircle.material.opacity = pulseOpacity;
            }
            
            // 批量更新波浪圆环
            this.updateWavesBatch(userData.waves, groupElapsed, this.config.waveDuration);
        });
    }

    /**
     * 批量更新波浪动画
     */
    updateWavesBatch(waves, groupElapsed, waveDuration) {
        for (let i = 0; i < waves.length; i++) {
            const wave = waves[i];
            const waveData = wave.userData;
            const waveElapsed = groupElapsed - waveData.animationOffset;
            
            if (waveElapsed < 0) {
                wave.visible = false;
                continue;
            }
            
            wave.visible = true;
            const progress = (waveElapsed % waveDuration) / waveDuration;
            
            if (progress > 1) {
                wave.visible = false;
                continue;
            }
            
            // 缩放和透明度计算
            const scale = waveData.initialScale + progress * waveData.maxScale;
            const fadeOut = 1 - Math.pow(progress, 1.5);
            const opacity = Math.max(0, waveData.initialOpacity * fadeOut);
            
            wave.scale.setScalar(scale);
            
            // 修复：使用ShaderMaterial的uniforms更新透明度
            if (waveData.material && waveData.material.uniforms) {
                waveData.material.uniforms.opacity.value = opacity;
            } else {
                // 兼容性：如果不是ShaderMaterial，使用传统方式
                wave.material.opacity = opacity;
            }
        }
    }

    /**
     * 批量更新弧线动画
     */
    updateArcsAnimationBatch(currentTime) {
        if (!this.arcsGroup || this.arcsGroup.children.length === 0) return;

        // 修复：优化弧线分帧逻辑，根据设备性能动态调整
        const totalArcs = this.arcsGroup.children.length;
        if (totalArcs === 0) return;
        
        // 根据设备性能和弧线数量动态调整每帧处理数量
        let maxArcsPerFrame;
        if (totalArcs <= 20) {
            maxArcsPerFrame = totalArcs; // 少量弧线时全量处理
        } else if (totalArcs <= 50) {
            maxArcsPerFrame = Math.max(10, Math.ceil(totalArcs / 3)); // 中等数量
        } else {
            maxArcsPerFrame = Math.max(15, Math.ceil(totalArcs / 4)); // 大量弧线时分帧处理
        }
        
        const startIndex = (this.arcUpdateIndex || 0) % totalArcs;
        const endIndex = Math.min(startIndex + maxArcsPerFrame, totalArcs);

        for (let i = startIndex; i < endIndex; i++) {
            const arcGroup = this.arcsGroup.children[i];
            const userData = arcGroup.userData;
            if (!userData || !userData.points) continue;
            
            const animationTime = (currentTime * 1000 + userData.animationOffset) % this.config.arcTime;
            const progress = animationTime / this.config.arcTime;
            
            // 更新飞线动画
            this.updateFlyingLineOptimized(arcGroup, progress);
            
            // 更新粒子位置
            if (userData.particle) {
                this.updateParticleOptimized(arcGroup, progress, Math.sin(currentTime * 30.0));
            }
        }

        // 修复：更新下一帧处理的起始索引
        this.arcUpdateIndex = endIndex;
        if (this.arcUpdateIndex >= totalArcs) {
            this.arcUpdateIndex = 0;
        }
    }

    /**
     * 飞线更新方法
     */
    updateFlyingLineOptimized(arcGroup, progress) {
        const userData = arcGroup.userData;
        const { points, flyingGeometry, flyingLength, totalPoints } = userData;
        
        if (!points || totalPoints === 0) return;
        
        // 使用缓存的计算结果
        const currentIndex = Math.floor(progress * totalPoints);
        const startIndex = Math.max(0, currentIndex - flyingLength);
        const endIndex = Math.min(totalPoints - 1, currentIndex);
        
        if (startIndex >= endIndex) {
            // 隐藏飞线而不是清空几何体
            if (userData.lastVisibleCount > 0) {
                userData.lastVisibleCount = 0;
                this.updateGeometryBuffers(flyingGeometry, [], []);
            }
            return;
        }
        
        const pointCount = endIndex - startIndex + 1;
        
        // 使用预分配的缓冲区
        const posBuffer = userData.positionBuffer;
        const colorBuffer = userData.colorBuffer;
        
        for (let i = 0; i < pointCount; i++) {
            const point = points[startIndex + i];
            const bufferIndex = i * 3;
            
            // 位置数据
            posBuffer[bufferIndex] = point.x;
            posBuffer[bufferIndex + 1] = point.y;
            posBuffer[bufferIndex + 2] = point.z;
            
            // 颜色渐变数据
            const intensity = i / (pointCount - 1);
            colorBuffer[bufferIndex] = intensity;
            colorBuffer[bufferIndex + 1] = intensity;
            colorBuffer[bufferIndex + 2] = intensity;
        }
        
        // 只在点数量发生变化时更新几何体
        if (userData.lastVisibleCount !== pointCount) {
            this.updateGeometryBuffers(
                flyingGeometry, 
                posBuffer.subarray(0, pointCount * 3),
                colorBuffer.subarray(0, pointCount * 3)
            );
            userData.lastVisibleCount = pointCount;
        } else {
            // 只更新位置和颜色数据，不重建几何体
            this.updateBufferAttributes(
                flyingGeometry,
                posBuffer.subarray(0, pointCount * 3),
                colorBuffer.subarray(0, pointCount * 3)
            );
        }
    }

    /**
     * 更新几何体缓冲区 - 重建属性（当点数量变化时）
     */
    updateGeometryBuffers(geometry, positions, colors) {
        if (positions.length === 0) {
            // 设置空几何体
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 3));
            geometry.setDrawRange(0, 0);
        } else {
            geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(), 3));
            geometry.setDrawRange(0, positions.length / 3);
        }
        
        // 标记需要更新
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
    }

    /**
     * 更新缓冲区属性数据 - 只更新数据（当点数量不变时）
     */
    updateBufferAttributes(geometry, positions, colors) {
        const positionAttr = geometry.attributes.position;
        const colorAttr = geometry.attributes.color;
        
        if (positionAttr && colorAttr) {
            // 直接更新缓冲区数据
            positionAttr.array.set(positions);
            colorAttr.array.set(colors);
            
            // 标记需要更新
            positionAttr.needsUpdate = true;
            colorAttr.needsUpdate = true;
        }
    }

    /**
     * 优化后的粒子更新方法
     */
    updateParticleOptimized(arcGroup, progress, sinParticleTime) {
        const userData = arcGroup.userData;
        const { points, particle, pointsPerProgress } = userData;
        
        if (!points || points.length === 0 || !particle) return;
        
        // 使用缓存的计算结果
        const currentIndex = Math.floor(progress * pointsPerProgress);
        const nextIndex = Math.min(currentIndex + 1, pointsPerProgress);
        
        if (currentIndex >= pointsPerProgress) {
            particle.visible = false;
            return;
        }
        
        particle.visible = true;
        
        // 插值计算
        const localProgress = (progress * pointsPerProgress) - currentIndex;
        const currentPoint = points[currentIndex];
        const nextPoint = points[nextIndex];
        
        // 使用缓存的临时向量避免创建新对象
        const tempVector = this.animationCache.tempVector;
        tempVector.lerpVectors(currentPoint, nextPoint, localProgress);
        particle.position.copy(tempVector);
        
        // 粒子效果
        const pulseScale = 1 + 0.5 * sinParticleTime;
        particle.scale.setScalar(pulseScale);
        
        // 透明度计算
        const fadeProgress = Math.sin(progress * Math.PI);
        particle.material.opacity = 0.8 * fadeProgress;
    }

    // 清理方法 - 修复：完善资源清理
    dispose() {
        console.log('Disposing Earth resources...');
        
        // 清理材质管理器
        if (this.materialManager) {
            this.materialManager.dispose();
        }

        // 清理几何体
        if (this.ringGeometries) {
            Object.values(this.ringGeometries).forEach(geometry => {
                if (geometry && geometry.dispose) geometry.dispose();
            });
            this.ringGeometries = null;
        }

        // 清理材质
        if (this.ringMaterials) {
            Object.values(this.ringMaterials).forEach(material => {
                if (material && material.dispose) material.dispose();
            });
            this.ringMaterials = null;
        }

        // 清理陆地点云
        if (this.landPoints) {
            this.remove(this.landPoints);
            if (this.landPoints.geometry) {
                this.landPoints.geometry.dispose();
            }
            if (this.landPoints.material) {
                if (Array.isArray(this.landPoints.material)) {
                    this.landPoints.material.forEach(mat => mat.dispose());
                } else {
                    this.landPoints.material.dispose();
                }
            }
            this.landPoints = null;
        }

        // 清理飞机航线资源
        if (this.flightRouteInstances) {
            this.flightRouteInstances.forEach(instance => {
                if (instance.airplane) {
                    instance.airplane.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                }
            });
            this.flightRouteInstances = [];
        }

        // 清理激光攻击
        if (this.laserAttacks) {
            this.laserAttacks.forEach(attack => {
                if (attack.group) {
                    this.remove(attack.group);
                    attack.group.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                }
            });
            this.laserAttacks = [];
        }

        // 清理爆炸特效
        if (this.explosionEffects) {
            this.explosionEffects.forEach(effect => {
                if (effect.group) {
                    this.remove(effect.group);
                    effect.group.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                }
            });
            this.explosionEffects = [];
        }

        // 清理国家材质缓存
        if (this.countryMaterials) {
            this.countryMaterials.forEach(material => {
                if (material && material.dispose) material.dispose();
            });
            this.countryMaterials.clear();
        }

        // 清理国家标签
        if (this.countryLabels) {
            this.countryLabels.forEach((label, countryName) => {
                if (label) {
                    this.remove(label);
                    if (label.material) {
                        if (label.material.map) label.material.map.dispose();
                        label.material.dispose();
                    }
                }
            });
            this.countryLabels.clear();
        }

        // 清理几何体和材质
        this.traverse(child => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        // 修复事件监听器移除：使用保存的绑定函数引用
        if (this.boundResizeHandler) {
            window.removeEventListener('resize', this.boundResizeHandler);
            this.boundResizeHandler = null;
        }
        
        console.log('Earth resources disposed successfully');
    }

    // 数据更新方法
    updateArcsData(newArcsData) {
        this.arcsData = newArcsData;
        if (this.arcsGroup) {
            this.remove(this.arcsGroup);
            // 清理旧的弧线资源
            this.arcsGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
        }
        if (newArcsData.length > 0) {
            this.createArcs();
        }
    }

    updatePointsData(newPointsData) {
        this.pointsData = newPointsData;
        
        // 清理旧资源
        if (this.pointsGroup) {
            this.remove(this.pointsGroup);
            this.pointsGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
        }
        if (this.ringsGroup) {
            this.remove(this.ringsGroup);
            // 清理环形几何体和材质引用
            this.ringsGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
        }
        
        if (newPointsData.length > 0) {
            this.createPoints();
            this.createRings();
        }
    }

    updateCountriesData(newCountriesData) {
        this.countriesData = newCountriesData;
        if (this.countriesGroup) {
            this.remove(this.countriesGroup);
            // 清理国家边界几何体
            this.countriesGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
            });
        }
        if (newCountriesData) {
            this.createCountries();
        }
    }

    /**
     * 更新陆地点云显示状态
     */
    updateLandPointsVisibility(show) {
        this.config.showLandPoints = show;
        if (show && !this.landPoints) {
            this.createLandPoints();
        } else if (!show && this.landPoints) {
            this.remove(this.landPoints);
            if (this.landPoints.geometry) {
                this.landPoints.geometry.dispose();
            }
            if (this.landPoints.material) {
                this.landPoints.material.dispose();
            }
            this.landPoints = null;
        }
    }

    /**
     * 重新创建陆地点云（例如密度配置改变时）
     */
    async recreateLandPoints() {
        if (this.landPoints) {
            this.remove(this.landPoints);
            if (this.landPoints.geometry) {
                this.landPoints.geometry.dispose();
            }
            if (this.landPoints.material) {
                this.landPoints.material.dispose();
            }
            this.landPoints = null;
        }
        
        if (this.config.showLandPoints) {
            await this.createLandPoints();
        }
    }

    /**
     * 创建基于纹理的陆地点云 - 修复跨域和错误处理
     */
    async createLandPoints() {
        try {
            // 创建canvas来读取纹理数据
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 创建图像对象
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            return new Promise((resolve, reject) => {
                // 设置超时时间
                const timeout = setTimeout(() => {
                    console.warn('Land points texture loading timeout');
                    resolve(); // 超时后继续，不影响其他功能
                }, 15000); // 15秒超时
                
                img.onload = () => {
                    clearTimeout(timeout);
                    try {
                        // 设置canvas尺寸（密度越大分辨率越高）
                        const baseResolution = 512;
                        const resolution = baseResolution * this.config.landPointDensity;
                        canvas.width = resolution;
                        canvas.height = resolution / 2; // 2:1 比例的等矩形投影
                        
                        // 绘制图像到canvas
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        // 获取像素数据
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        
                        // 分析像素并创建点云
                        const landPositions = this.extractLandPositions(data, canvas.width, canvas.height);
                        
                        if (landPositions.length > 0) {
                            this.createLandPointsGeometry(landPositions);
                            console.log('Land points created successfully');
                        } else {
                            console.warn('No land positions extracted from texture');
                        }
                        
                        this.onLoad();
                        resolve();
                    } catch (error) {
                        console.warn('Error processing land points texture:', error);
                        resolve(); // 出错后继续，不影响其他功能
                    }
                };
                
                img.onerror = (error) => {
                    clearTimeout(timeout);
                    console.warn('无法加载地球纹理，跳过陆地点云创建:', error);
                    // 修复：纹理加载失败时仍然调用onLoad，避免阻塞其他功能
                    this.onLoad();
                    resolve();
                };
                
                // 修复：尝试多个可能的纹理路径
                const texturePaths = [
                    '/texture/earth/github/earth.jpg',
                    '/texture/earth/earth.jpg',
                    '/texture/earth.jpg',
                    'texture/earth/github/earth.jpg'
                ];
                
                this.loadTextureWithFallback(img, texturePaths, 0);
            });
        } catch (error) {
            console.warn('创建陆地点云时出错:', error);
            // 修复：确保即使出错也调用onLoad
            this.onLoad();
        }
    }
    
    /**
     * 递归尝试加载纹理，支持多个备选路径
     */
    loadTextureWithFallback(img, paths, index) {
        if (index >= paths.length) {
            console.warn('All texture paths failed, skipping land points');
            img.onerror();
            return;
        }
        
        console.log(`Trying to load texture: ${paths[index]}`);
        img.src = paths[index];
        
        // 如果当前路径失败，尝试下一个
        const originalOnError = img.onerror;
        img.onerror = (error) => {
            console.warn(`Failed to load texture from ${paths[index]}:`, error);
            this.loadTextureWithFallback(img, paths, index + 1);
        };
    }

    /**
     * 从纹理数据中提取陆地位置 - 优化采样性能
     */
    extractLandPositions(data, width, height) {
        const positions = [];
        const threshold = 128; // 黑白阈值
        
        // 修复：使用固定步长采样，避免随机数性能开销
        const stepSize = Math.max(1, Math.floor(Math.sqrt(width * height / 10000))); // 动态步长，保持约1万个点
        console.log(`Land points sampling with step size: ${stepSize}`);
        
        for (let y = 0; y < height; y += stepSize) {
            for (let x = 0; x < width; x += stepSize) {
                const index = (y * width + x) * 4;
                
                // 边界检查
                if (index + 2 >= data.length) continue;
                
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                // 计算灰度值
                const grayscale = (r + g + b) / 3;
                
                // 如果是黑色区域（陆地），创建点
                if (grayscale < threshold) {
                    // 修复：移除随机跳过，使用固定步长提高性能
                    
                    // 将像素坐标转换为经纬度
                    const lon = (x / width) * 360 - 180;
                    const lat = 90 - (y / height) * 180;
                    
                    // 转换为3D坐标
                    const position = this.latLngToVector3(lat, lon, this.radius + 0.5);
                    positions.push(position.x, position.y, position.z);
                }
            }
        }
        
        console.log(`Extracted ${positions.length / 3} land points from texture`);
        return positions;
    }

    /**
     * 创建陆地点云几何体 - 修复纹理加载错误处理
     */
    createLandPointsGeometry(positions) {
        // 创建几何体
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        // 修复：改进点纹理加载，支持备选路径和错误处理
        const loader = new THREE.TextureLoader();
        const dotTexturePaths = [
            '/texture/earth/github/dot.png',
            '/texture/earth/dot.png',
            '/texture/dot.png',
            'texture/earth/github/dot.png'
        ];
        
        let dotTexture = null;
        let textureLoadIndex = 0;
        
        const tryLoadTexture = (pathIndex) => {
            if (pathIndex >= dotTexturePaths.length) {
                // 所有路径都失败，创建不带纹理的材质
                console.warn('All dot texture paths failed, creating material without texture');
                this.createLandPointsMaterial(geometry, null);
                return;
            }
            
            const path = dotTexturePaths[pathIndex];
            console.log(`Trying to load dot texture: ${path}`);
            
            loader.load(
                path,
                (texture) => {
                    console.log(`Dot texture loaded successfully from ${path}`);
                    this.createLandPointsMaterial(geometry, texture);
                },
                undefined,
                (error) => {
                    console.warn(`Failed to load dot texture from ${path}:`, error);
                    tryLoadTexture(pathIndex + 1);
                }
            );
        };
        
        tryLoadTexture(0);
    }
    
    /**
     * 创建陆地点云材质
     */
    createLandPointsMaterial(geometry, texture) {
        // 使用材质管理器创建点云材质
        const material = new THREE.PointsMaterial({
            color: new THREE.Color(this.config.landPointColor),
            size: this.config.landPointSize,
            map: texture, // 可能为null
            transparent: true,
            opacity: this.config.landPointOpacity,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            vertexColors: false
        });
        
        // 创建点云对象
        this.landPoints = new THREE.Points(geometry, material);
        this.landPoints.name = 'LandPoints';
        
        // 添加到场景
        this.add(this.landPoints);
        
        console.log('Land points geometry created successfully');
    }

    /**
     * 异步加载纹理的辅助方法
     */
    loadTexture(url) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                url,
                resolve,
                undefined,
                reject
            );
        });
    }

    /**
     * 创建飞机航线
     */
    async createFlightRoutes() {
        this.flightRoutesGroup = new THREE.Group();
        this.flightRoutesGroup.name = 'FlightRoutes';
        
        // 存储飞机航线数据
        this.flightRouteInstances = [];

        // 加载飞机模型 - 修复：改进错误处理
        try {
            this.airplaneModel = await this.loadAirplaneModel();
            if (this.airplaneModel) {
                // 缩放飞机模型
                this.airplaneModel.scale.setScalar(this.config.airplaneScale);
                // 初始化飞机位置和可见性
                this.airplaneModel.visible = false;
                console.log('Airplane model loaded successfully');
            } else {
                throw new Error('Airplane model is null');
            }
        } catch (error) {
            console.warn('Failed to load airplane model:', error);
            // 修复：创建备用飞机模型，避免后续创建航线时出错
            this.createFallbackAirplaneModel();
        }
        
        // 为每条航线创建虚线轨迹和飞机
        for (let i = 0; i < this.flightRoutesData.length; i++) {
            const route = this.flightRoutesData[i];
            await this.createSingleFlightRoute(route, i);
        }
        
        this.add(this.flightRoutesGroup);
    }

    /**
     * 创建单条航线
     */
    async createSingleFlightRoute(route, index) {
        const routeGroup = new THREE.Group();
        routeGroup.name = `FlightRoute_${route.id}`;
        
        // 计算航线轨迹点
        const startPos = this.latLngToVector3(route.startLat, route.startLng, this.radius);
        const endPos = this.latLngToVector3(route.endLat, route.endLng, this.radius);
        const angle = startPos.angleTo(endPos);
        const arcHeight = this.radius * (route.arcAlt || 0.3);
        
        // 创建航线曲线
        const curve = this.createCurve(startPos, endPos, angle, arcHeight, Math.PI / 3);
        // 增加点数以获得更平滑的动画
        const routePoints = curve.getPoints(200);
        
        // 创建虚线轨迹
        this.createDashedTrack(routeGroup, routePoints, route.color);
        
        const airplane = this.airplaneModel.clone();
        airplane.name = 'airplane';
        const camera = this.airplaneCamera.clone();
        
        // 优化相机设置 - 设置更合适的距离和角度
        camera.position.set(0, 600, -800);
        camera.lookAt(0, 0, 100);
        
        airplane.add(camera);
        airplane.userData.camera = camera;

        airplane.position.copy(routePoints[0]);
        routeGroup.add(airplane);
        
        // 存储航线实例数据 - 修复：初始化默认方向
        const routeInstance = {
            group: routeGroup,
            route: route,
            index: index,
            points: routePoints,
            airplane: airplane,
            animationProgress: 0,
            direction: 1, // 1: 正向, -1: 反向
            isReturning: false,
            pauseStartTime: 0,
            isPaused: false,
            opacity: 0,
            // 添加平滑插值缓存
            lastPosition: routePoints[0].clone(),
            lastQuaternion: new THREE.Quaternion(),
            targetPosition: routePoints[0].clone(),
            targetQuaternion: new THREE.Quaternion(),
            // 修复：初始化默认方向，避免NaN
            lastDirection: new THREE.Vector3().subVectors(routePoints[1] || routePoints[0], routePoints[0]).normalize(),
            needsDirectionChange: false,
            // 添加方向验证标志
            hasValidDirection: true
        };
        
        this.flightRouteInstances.push(routeInstance);
        this.flightRoutesGroup.add(routeGroup);
    }

    onWindowResize(){
        this.flightRouteInstances.forEach(instance => {
            if(instance.airplane.userData.camera){
                instance.airplane.userData.camera.aspect = sizes.width / sizes.height;
                instance.airplane.userData.camera.updateProjectionMatrix();
            }
        });
    }

    /**
     * 创建虚线轨迹
     */
    createDashedTrack(routeGroup, points, color) {
        // 创建线段几何体
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // 创建虚线材质
        const material = new THREE.LineDashedMaterial({
            color: new THREE.Color(color),
            dashSize: 3,
            gapSize: 1.5,
        });
        
        // 创建虚线对象
        const dashedLine = new THREE.Line(geometry, material);
        dashedLine.computeLineDistances(); // 计算线段距离，虚线效果需要
        dashedLine.renderOrder = 6;
        dashedLine.name = 'track';
        
        routeGroup.add(dashedLine);
    }

    /**
     * 创建备用飞机模型 - 当模型加载失败时使用
     */
    createFallbackAirplaneModel() {
        console.log('Creating fallback airplane model');
        
        // 创建简单的飞机几何体
        const airplaneGroup = new THREE.Group();
        
        // 机身
        const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.2, 2, 8);
        const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.z = Math.PI / 2;
        airplaneGroup.add(body);
        
        // 机翼
        const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.5);
        const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
        const wing = new THREE.Mesh(wingGeometry, wingMaterial);
        wing.position.y = 0.1;
        airplaneGroup.add(wing);
        
        // 尾翼
        const tailGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
        const tailMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(-0.8, 0.4, 0);
        airplaneGroup.add(tail);
        
        this.airplaneModel = airplaneGroup;
        this.airplaneModel.scale.setScalar(this.config.airplaneScale);
        this.airplaneModel.visible = false;
        
        console.log('Fallback airplane model created');
    }

    /**
     * 加载飞机模型
     */
    async loadAirplaneModel() {
        return new Promise((resolve, reject) => {
            // 修复：检查GLTFLoader是否可用
            if (!gltfLoader) {
                reject(new Error('GLTFLoader not available'));
                return;
            }
            
            // 设置超时时间，避免无限等待
            const timeout = setTimeout(() => {
                reject(new Error('Airplane model loading timeout'));
            }, 10000); // 10秒超时
            
            gltfLoader.load(
                '/models/airplane/airplane.glb',
                (gltf) => {
                    clearTimeout(timeout);
                    try {
                        const airplane = gltf.scene.clone();
                        airplane.name = 'airplane';
                        
                        // 确保材质正确设置
                        airplane.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = false;
                                child.receiveShadow = false;
                                if (child.material) {
                                    child.material.transparent = true;
                                }
                            }
                        });
                        
                        // 修复：清理原始gltf资源，避免内存泄漏
                        if (gltf.scene) {
                            gltf.scene.traverse(child => {
                                if (child.geometry) child.geometry.dispose();
                                if (child.material) {
                                    if (Array.isArray(child.material)) {
                                        child.material.forEach(mat => mat.dispose());
                                    } else {
                                        child.material.dispose();
                                    }
                                }
                            });
                        }
                        
                        resolve(airplane);
                    } catch (error) {
                        reject(new Error(`Failed to process airplane model: ${error.message}`));
                    }
                },
                (progress) => {
                    // 加载进度
                    if (progress.lengthComputable) {
                        const percentComplete = (progress.loaded / progress.total) * 100;
                        console.log(`Airplane model loading: ${percentComplete.toFixed(2)}%`);
                    }
                },
                (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`Failed to load airplane model: ${error.message || 'Unknown error'}`));
                }
            );
        });
    }

    /**
     * 更新飞机航线动画
     */
    updateFlightRoutesAnimation(currentTime) {
        if (!this.flightRouteInstances || this.flightRouteInstances.length === 0) return;
        
        this.flightRouteInstances.forEach(routeInstance => {
            this.updateSingleFlightRoute(routeInstance, currentTime);
        });
    }

    /**
     * 更新单个航线动画
     */
    updateSingleFlightRoute(routeInstance, currentTime) {
        const { airplane, points, route } = routeInstance;
        if (!airplane || !points || points.length === 0) return;
        
        // 处理暂停逻辑
        if (routeInstance.isPaused) {
            const pauseDuration = currentTime - routeInstance.pauseStartTime;
            if (pauseDuration >= this.config.flightPauseTime) {
                routeInstance.isPaused = false;
                routeInstance.direction *= -1; // 切换方向
                routeInstance.isReturning = !routeInstance.isReturning;
                routeInstance.animationProgress = routeInstance.isReturning ? 1 : 0;
                routeInstance.needsDirectionChange = false; // 重置标记
                
                // 方向切换后，重新计算初始朝向以避免突变
                const newProgress = routeInstance.animationProgress;
                const newPosition = this.getSplineInterpolatedPosition(points, newProgress);
                
                // 计算新方向的初始朝向
                const lookAheadDistance = 0.01; // 稍大一点的前瞻距离
                const lookAheadProgress = Math.max(0, Math.min(1, newProgress + lookAheadDistance * routeInstance.direction));
                const lookAheadPosition = this.getSplineInterpolatedPosition(points, lookAheadProgress);
                const newDirection = new THREE.Vector3().subVectors(lookAheadPosition, newPosition).normalize();
                
                if (newDirection.length() > 0) {
                    routeInstance.lastDirection = newDirection.clone();
                }
            } else {
                // 在暂停期间，保持飞机朝向稳定，避免视角突变
                return; // 仍在暂停中
            }
        }
        
        // 更新动画进度 - 使用固定的时间步长确保平滑
        const speed = this.config.flightAnimationSpeed / 1000;
        const deltaProgress = speed * routeInstance.direction;
        routeInstance.animationProgress += deltaProgress;
        
        // 检查是否到达端点
        if (routeInstance.animationProgress >= 1 || routeInstance.animationProgress <= 0) {
            routeInstance.animationProgress = Math.max(0, Math.min(1, routeInstance.animationProgress));
            routeInstance.isPaused = true;
            routeInstance.pauseStartTime = currentTime;
            // 标记需要方向切换，但不立即执行
            routeInstance.needsDirectionChange = true;
        }
        
        // 确保progress始终在有效范围内，防止插值计算错误
        const progress = Math.max(0, Math.min(1, routeInstance.animationProgress));
        
        // 使用样条插值获得更平滑的位置
        const position = this.getSplineInterpolatedPosition(points, progress);
        
        // 修复：改进的方向计算 - 避免NaN和突变
        let direction;
        
        // 在端点附近时使用特殊的方向计算
        const endpointThreshold = 0.02; // 端点阈值
        if (progress <= endpointThreshold || progress >= (1 - endpointThreshold)) {
            // 在端点附近，使用更稳定的方向计算
            if (routeInstance.hasValidDirection && routeInstance.lastDirection && routeInstance.lastDirection.length() > 0) {
                // 如果有上一个有效方向，继续使用它保持稳定
                direction = routeInstance.lastDirection.clone();
            } else {
                // 使用轨迹的总体方向
                const startPoint = points[0];
                const endPoint = points[points.length - 1];
                direction = new THREE.Vector3().subVectors(endPoint, startPoint);
                
                // 验证方向是否有效
                if (direction.length() > 0.001) {
                    direction.normalize();
                    if (routeInstance.direction < 0) {
                        direction.negate(); // 如果是返回方向，反转
                    }
                    routeInstance.hasValidDirection = true;
                } else {
                    // 如果方向无效，使用默认方向
                    direction = new THREE.Vector3(1, 0, 0);
                    routeInstance.hasValidDirection = false;
                }
            }
        } else {
            // 在轨迹中间时，使用正常的前瞻计算
            const lookAheadDistance = 0.005;
            const lookAheadProgress = Math.max(0, Math.min(1, progress + lookAheadDistance * routeInstance.direction));
            const lookAheadPosition = this.getSplineInterpolatedPosition(points, lookAheadProgress);
            
            // 计算方向向量
            direction = new THREE.Vector3().subVectors(lookAheadPosition, position);
            
            // 验证方向是否有效（长度大于阈值且所有分量都是有限数）
            if (direction.length() > 0.001 && 
                isFinite(direction.x) && isFinite(direction.y) && isFinite(direction.z)) {
                direction.normalize();
                routeInstance.lastDirection = direction.clone();
                routeInstance.hasValidDirection = true;
            } else if (routeInstance.hasValidDirection && routeInstance.lastDirection && routeInstance.lastDirection.length() > 0) {
                // 如果当前方向无效，使用上一个有效方向
                direction = routeInstance.lastDirection.clone();
            } else {
                // 使用默认方向
                direction = new THREE.Vector3(1, 0, 0);
                routeInstance.hasValidDirection = false;
                console.warn(`Invalid direction calculated for airplane at progress ${progress}`);
            }
        }
        
        // 平滑更新飞机位置
        const smoothingFactor = 0.15; // 平滑系数，值越小越平滑但延迟越大
        routeInstance.targetPosition.copy(position);
        routeInstance.lastPosition.lerp(routeInstance.targetPosition, smoothingFactor);
        airplane.position.copy(routeInstance.lastPosition);
        
        // 设置飞机朝向 - 使用更平滑的旋转方法
        this.setAirplaneOrientationSmooth(airplane, direction, position, routeInstance);
        
        // 计算透明度（渐显渐隐效果）
        const fadeDistance = 0.15; // 渐变区域占总长度的比例
        let opacity = 1;
        
        if (progress < fadeDistance) {
            // 起始渐显
            opacity = progress / fadeDistance;
        } else if (progress > (1 - fadeDistance)) {
            // 结束渐隐
            opacity = (1 - progress) / fadeDistance;
        }
        
        // 应用透明度
        airplane.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.opacity = opacity;
                child.material.transparent = true;
            }
        });
        
        // 控制可见性
        airplane.visible = opacity > 0.01;
        
        routeInstance.opacity = opacity;
    }

    /**
     * 使用样条插值获得更平滑的位置
     */
    getSplineInterpolatedPosition(points, progress) {
        if (!points || points.length === 0) {
            console.warn('getSplineInterpolatedPosition: points array is empty or undefined');
            return new THREE.Vector3();
        }

        // 确保progress在有效范围内
        progress = Math.max(0, Math.min(1, progress));

        if (points.length === 1) {
            return points[0].clone();
        }

        if (points.length < 4) {
            // 如果点数不足，使用线性插值
            const index = progress * (points.length - 1);
            const currentIndex = Math.floor(index);
            const nextIndex = Math.min(currentIndex + 1, points.length - 1);
            const localProgress = index - currentIndex;
            
            // 确保索引在有效范围内
            const safeCurrentIndex = Math.max(0, Math.min(currentIndex, points.length - 1));
            const safeNextIndex = Math.max(0, Math.min(nextIndex, points.length - 1));
            
            return new THREE.Vector3().lerpVectors(points[safeCurrentIndex], points[safeNextIndex], localProgress);
        }
        
        // 使用Catmull-Rom样条插值
        const totalSegments = points.length - 1;
        const segmentProgress = progress * totalSegments;
        const segmentIndex = Math.floor(segmentProgress);
        const localProgress = segmentProgress - segmentIndex;
        
        // 确保索引在有效范围内
        const safeSegmentIndex = Math.max(0, Math.min(segmentIndex, points.length - 2));
        const p0Index = Math.max(0, safeSegmentIndex - 1);
        const p1Index = safeSegmentIndex;
        const p2Index = Math.min(safeSegmentIndex + 1, points.length - 1);
        const p3Index = Math.min(safeSegmentIndex + 2, points.length - 1);
        
        const p0 = points[p0Index];
        const p1 = points[p1Index];
        const p2 = points[p2Index];
        const p3 = points[p3Index];
        
        // 验证所有点都存在
        if (!p0 || !p1 || !p2 || !p3) {
            console.warn('getSplineInterpolatedPosition: One or more control points are undefined', {
                p0Index, p1Index, p2Index, p3Index,
                pointsLength: points.length,
                progress: progress
            });
            // 降级到线性插值
            const fallbackIndex = Math.min(p1Index, points.length - 1);
            const fallbackNextIndex = Math.min(p1Index + 1, points.length - 1);
            return new THREE.Vector3().lerpVectors(
                points[fallbackIndex] || new THREE.Vector3(),
                points[fallbackNextIndex] || points[fallbackIndex] || new THREE.Vector3(),
                localProgress
            );
        }
        
        // Catmull-Rom插值公式
        const t = localProgress;
        const t2 = t * t;
        const t3 = t2 * t;
        
        const result = new THREE.Vector3();
        result.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        result.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        result.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
        
        return result;
    }

    /**
     * 设置飞机的朝向，使用更平滑的旋转方法
     */
    setAirplaneOrientationSmooth(airplane, direction, position, routeInstance) {
        // 计算从地心到飞机位置的向量（用作up向量）
        const up = position.clone().normalize();
        
        // 计算right向量（垂直于direction和up的向量）
        const right = new THREE.Vector3().crossVectors(up, direction).normalize();
        
        // 重新计算up向量确保正交
        const correctedUp = new THREE.Vector3().crossVectors(direction, right).normalize();
        
        // 创建目标旋转矩阵
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeBasis(right, correctedUp, direction);
        
        // 从旋转矩阵提取四元数
        routeInstance.targetQuaternion.setFromRotationMatrix(rotationMatrix);
        
        // 应用旋转调整（如果需要）
        const adjustmentAngle = this.config.airplaneRotationAdjustment || 0;
        if (adjustmentAngle !== 0) {
            const adjustmentQuaternion = new THREE.Quaternion().setFromAxisAngle(
                correctedUp,
                adjustmentAngle
            );
            routeInstance.targetQuaternion.multiplyQuaternions(routeInstance.targetQuaternion, adjustmentQuaternion);
        }
        
        // 动态调整旋转平滑系数 - 在端点附近使用更强的平滑
        const progress = routeInstance.animationProgress;
        const endpointThreshold = 0.05; // 端点阈值
        let rotationSmoothingFactor = 0.2; // 默认旋转平滑系数
        
        if (progress <= endpointThreshold || progress >= (1 - endpointThreshold)) {
            // 在端点附近，使用更强的平滑
            rotationSmoothingFactor = 0.05;
        } else if (progress <= endpointThreshold * 2 || progress >= (1 - endpointThreshold * 2)) {
            // 在端点附近的缓冲区，使用中等平滑
            rotationSmoothingFactor = 0.1;
        }
        
        // 如果飞机正在暂停或即将改变方向，进一步降低平滑系数
        if (routeInstance.isPaused || routeInstance.needsDirectionChange) {
            rotationSmoothingFactor = 0.02; // 更强的平滑以避免突变
        }
        
        // 平滑插值到目标旋转
        routeInstance.lastQuaternion.slerp(routeInstance.targetQuaternion, rotationSmoothingFactor);
        
        // 应用旋转
        airplane.quaternion.copy(routeInstance.lastQuaternion);
    }

    /**
     * 平滑更新飞机相机
     */
    updateFlightCameraSmooth(delta) {
        if (!this.flightRouteInstances) return;

        this.flightRouteInstances.forEach(routeInstance => {
            const camera = routeInstance.airplane.userData.camera;
            if (!camera) return;

            // 为相机添加平滑的振动减少
            const dampingFactor = 0.05;
            if (camera.userData.lastPosition) {
                const targetPosition = routeInstance.airplane.position.clone();
                camera.userData.lastPosition.lerp(targetPosition, dampingFactor);
            } else {
                camera.userData.lastPosition = routeInstance.airplane.position.clone();
            }

            // 应用额外的相机稳定
            if (camera.userData.stabilizer) {
                camera.userData.stabilizer += delta * 0.001;
                // 添加轻微的相机摆动抑制
                const stabilizationOffset = new THREE.Vector3(
                    Math.sin(camera.userData.stabilizer * 0.5) * 0.1,
                    Math.cos(camera.userData.stabilizer * 0.3) * 0.05,
                    0
                );
                camera.position.add(stabilizationOffset);
            } else {
                camera.userData.stabilizer = 0;
            }
        });
    }

    /**
     * 高亮指定国家 - 修复名称匹配问题
     * @param {string} countryName - 国家名称
     * @param {string} color - 高亮颜色
     * @param {number} intensity - 高亮强度
     */
    highlightCountry(countryName, color = '#ff6b6b', intensity = 0.8) {
        if (!this.countriesGroup) {
            console.warn('Countries group not found');
            return;
        }

        console.log(`Attempting to highlight country: ${countryName}`);
        
        // 修复：支持多种名称匹配方式
        const standardName = this.getCountryStandardName(countryName);
        console.log(`Standardized name: ${standardName}`);
        console.log(`Available countries:`, this.countriesGroup.children.map(child => ({
            countryName: child.userData?.countryName,
            standardName: child.userData?.standardName
        })).filter(child => child.countryName));

        // 查找对应的国家填充网格 - 支持原始名称和标准名称匹配
        const countryMeshes = this.countriesGroup.children.filter(child => 
            child.userData && 
            child.userData.type === 'fill' && (
                child.userData.countryName === countryName ||
                child.userData.countryName === standardName ||
                child.userData.standardName === countryName ||
                child.userData.standardName === standardName
            )
        );

        if (countryMeshes.length === 0) {
            console.warn(`Country ${countryName} (standardized: ${standardName}) not found for highlighting`);
            console.log('Available country names:', Array.from(new Set(
                this.countriesGroup.children
                    .map(child => child.userData?.countryName)
                    .filter(Boolean)
            )));
            return;
        }

        countryMeshes.forEach(mesh => {
            // 保存原始材质
            if (!this.countryMaterials.has(`${countryName}-${mesh.uuid}`)) {
                this.countryMaterials.set(`${countryName}-${mesh.uuid}`, mesh.material.clone());
            }

            // 创建高亮材质
            const highlightMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(color),
                transparent: true,
                opacity: intensity,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });

            mesh.material = highlightMaterial;
            
            // 确保网格在3D球面上正确显示
            mesh.position.set(0, 0, 0); // 重置位置
            mesh.scale.set(1, 1, 1); // 重置缩放
            mesh.rotation.set(0, 0, 0); // 重置旋转
        });

        this.highlightedCountries.set(countryName, {
            color,
            intensity,
            meshes: countryMeshes
        });

        console.log(`Successfully highlighted country: ${countryName} with ${countryMeshes.length} meshes`);
    }

    /**
     * 取消国家高亮
     * @param {string} countryName - 国家名称
     */
    unhighlightCountry(countryName) {
        if (!this.highlightedCountries.has(countryName)) return;

        const highlightData = this.highlightedCountries.get(countryName);
        
        highlightData.meshes.forEach(mesh => {
            const materialKey = `${countryName}-${mesh.uuid}`;
            if (this.countryMaterials.has(materialKey)) {
                mesh.material = this.countryMaterials.get(materialKey);
            }
        });

        this.highlightedCountries.delete(countryName);
        console.log(`Unhighlighted country: ${countryName}`);
    }

    /**
     * 清除所有国家高亮
     */
    clearAllHighlights() {
        this.highlightedCountries.forEach((_, countryName) => {
            this.unhighlightCountry(countryName);
        });
    }

    /**
     * 创建文本纹理
     */
    createTextTexture(text, fontSize = 64, textColor = '#ffffff', bgColor = 'transparent') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // 设置canvas大小
        canvas.width = 512;
        canvas.height = 128;
        
        // 设置字体
        context.font = `bold ${fontSize}px Arial, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // 绘制背景
        if (bgColor !== 'transparent') {
            context.fillStyle = bgColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // 添加描边效果
        context.strokeStyle = '#000000';
        context.lineWidth = 8;
        context.strokeText(text, canvas.width / 2, canvas.height / 2);
        
        // 绘制文本
        context.fillStyle = textColor;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // 创建纹理
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        return texture;
    }

    /**
     * 在国家上方添加标签
     * @param {string} countryName - 国家名称
     * @param {string} labelText - 标签文本（Challenge类别名称）
     * @param {string} color - 文本颜色
     */
    addCountryLabel(countryName, labelText, color = '#ffffff') {
        // 尝试从国家几何体计算实际中心位置
        const geometryCenter = this.getCountryGeometryCenter(countryName);
        const position = geometryCenter || this.getCountry3DPosition(countryName);
        
        if (!position) {
            console.warn(`Cannot create label for ${countryName}: position not found`);
            return;
        }

        // 创建超大文本纹理
        const texture = this.createTextTexture(labelText, 84, color); // 从80改为96，更大字体
        
        // 创建Sprite材质
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.95,
            depthTest: true, // 始终显示在最前面
        });
        
        // 创建Sprite
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // 计算标签位置（在国家上方，更低更大）
        const labelHeight = 12; // 从15改为12，更贴近地表
        const labelPosition = new THREE.Vector3(position.x, position.y, position.z);
        labelPosition.normalize().multiplyScalar(this.radius + labelHeight);
        
        sprite.position.copy(labelPosition);
        
        // 设置超大标签尺寸（根据文本长度动态调整）
        const baseScale = 70; // 基础大小从50改为70
        const lengthScale = labelText.length * 8; // 长度系数从6改为8
        const scale = Math.max(baseScale, lengthScale);
        sprite.scale.set(scale, scale / 3.5, 1); // 从4:1改为3.5:1，稍微高一点
        
        sprite.userData = {
            countryName,
            labelText,
            type: 'countryLabel'
        };
        
        // 添加到场景
        this.add(sprite);
        
        // 存储标签引用
        this.countryLabels.set(countryName, sprite);
        
        console.log(`Created label "${labelText}" for ${countryName} at height ${labelHeight}, scale: ${scale}`);
    }

    /**
     * 获取国家几何体的实际中心位置
     */
    getCountryGeometryCenter(countryName) {
        if (!this.countriesGroup) return null;
        
        // 查找国家的填充网格（type='fill'）
        const countryMeshes = this.countriesGroup.children.filter(child =>
            child.userData && 
            child.userData.type === 'fill' && 
            (child.userData.countryName === countryName || 
             child.userData.standardName === countryName)
        );
        
        if (countryMeshes.length === 0) return null;
        
        // 计算所有填充网格的几何中心
        const center = new THREE.Vector3();
        let vertexCount = 0;
        
        countryMeshes.forEach(mesh => {
            if (mesh.geometry && mesh.geometry.attributes.position) {
                const positions = mesh.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    center.x += positions[i];
                    center.y += positions[i + 1];
                    center.z += positions[i + 2];
                    vertexCount++;
                }
            }
        });
        
        if (vertexCount > 0) {
            center.divideScalar(vertexCount);
            console.log(`Calculated geometry center for ${countryName}:`, center);
            return { x: center.x, y: center.y, z: center.z };
        }
        
        return null;
    }

    /**
     * 移除国家标签
     * @param {string} countryName - 国家名称
     */
    removeCountryLabel(countryName) {
        const label = this.countryLabels.get(countryName);
        if (label) {
            this.remove(label);
            if (label.material) {
                if (label.material.map) label.material.map.dispose();
                label.material.dispose();
            }
            this.countryLabels.delete(countryName);
            console.log(`Removed label for ${countryName}`);
        }
    }

    /**
     * 清除所有国家标签
     */
    clearAllLabels() {
        this.countryLabels.forEach((label, countryName) => {
            this.removeCountryLabel(countryName);
        });
    }

    /**
     * 更新标签位置和朝向（在update方法中调用）
     */
    updateLabels(camera) {
        if (!camera) return;
        
        this.countryLabels.forEach((label, countryName) => {
            // 让标签始终面向相机
            label.lookAt(camera.position);
        });
    }

    /**
     * 创建激光攻击 - 使用曲线路径避免穿过地球
     * @param {Object} fromPosition - 起始位置 {x, y, z}
     * @param {Object} toPosition - 目标位置 {x, y, z}
     * @param {string} color - 激光颜色
     * @param {number} duration - 持续时间（毫秒）
     * @param {boolean} isSuccess - 是否成功
     */
    createLaserAttack(fromPosition, toPosition, color = '#ff0000', duration = 5000, isSuccess = true) {
        console.log(`Creating curved laser attack from (${fromPosition.x}, ${fromPosition.y}, ${fromPosition.z}) to (${toPosition.x}, ${toPosition.y}, ${toPosition.z})`);
        
        const laserGroup = new THREE.Group();
        laserGroup.name = 'laserAttack';

        // 创建曲线路径，类似飞线
        const startPos = new THREE.Vector3(fromPosition.x, fromPosition.y, fromPosition.z);
        const endPos = new THREE.Vector3(toPosition.x, toPosition.y, toPosition.z);
        
        // 计算两点间的角度和弧线
        const angle = startPos.angleTo(endPos);
        const arcHeight = this.radius * 0.3; // 弧线高度
        const angleThreshold = Math.PI / 3; // 60度
        
        // 根据角度选择曲线类型
        const curve = this.createCurve(startPos, endPos, angle, arcHeight, angleThreshold);
        const curvePoints = curve.getPoints(50); // 获取曲线上的点
        
        // 创建激光束几何体
        const laserGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const laserMaterial = new THREE.LineBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            linewidth: 3
        });

        const laserBeam = new THREE.Line(laserGeometry, laserMaterial);
        laserBeam.renderOrder = 10; // 确保激光在最前面
        laserGroup.add(laserBeam);

        // 添加激光粒子效果 - 沿曲线分布
        const particleCount = 80;
        const particles = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);
        const particleSizes = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const progress = i / particleCount;
            
            // 沿曲线路径分布粒子
            const pointIndex = Math.floor(progress * (curvePoints.length - 1));
            const point = curvePoints[pointIndex];
            
            particlePositions[i3] = point.x;
            particlePositions[i3 + 1] = point.y;
            particlePositions[i3 + 2] = point.z;
            
            // 设置粒子颜色
            const particleColor = new THREE.Color(color);
            particleColors[i3] = particleColor.r;
            particleColors[i3 + 1] = particleColor.g;
            particleColors[i3 + 2] = particleColor.b;
            
            particleSizes[i] = Math.random() * 2 + 1;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

        const particleMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particleSystem = new THREE.Points(particles, particleMaterial);
        laserGroup.add(particleSystem);

        // 添加到场景
        this.add(laserGroup);
        this.laserAttacks.push({
            group: laserGroup,
            startTime: Date.now(),
            duration,
            isSuccess,
            targetPosition: toPosition,
            curvePoints,
            particleSystem,
            particles
        });

        // 设置自动清理 - 5秒后清除
        setTimeout(() => {
            this.removeLaserAttack(laserGroup);
        }, duration);

        // 如果成功，创建爆炸特效
        if (isSuccess) {
            setTimeout(() => {
                this.createExplosionEffect(toPosition, color);
            }, duration * 0.8);
        }

        console.log(`Created curved laser attack from (${fromPosition.x}, ${fromPosition.y}, ${fromPosition.z}) to (${toPosition.x}, ${toPosition.y}, ${toPosition.z})`);
    }

    /**
     * 移除激光攻击
     * @param {THREE.Group} laserGroup - 激光组
     */
    removeLaserAttack(laserGroup) {
        this.remove(laserGroup);
        
        // 清理几何体和材质
        laserGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        // 从数组中移除
        const index = this.laserAttacks.findIndex(attack => attack.group === laserGroup);
        if (index !== -1) {
            this.laserAttacks.splice(index, 1);
        }
    }

    /**
     * 创建爆炸特效
     * @param {Object} position - 爆炸位置 {x, y, z}
     * @param {string} color - 爆炸颜色
     */
    createExplosionEffect(position, color = '#ff6b6b') {
        const explosionGroup = new THREE.Group();
        explosionGroup.name = 'explosionEffect';

        // 创建爆炸粒子
        const particleCount = 100;
        const particles = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleVelocities = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);
        const particleSizes = new Float32Array(particleCount);
        const particleLifetimes = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // 初始位置
            particlePositions[i3] = position.x;
            particlePositions[i3 + 1] = position.y;
            particlePositions[i3 + 2] = position.z;
            
            // 随机速度
            particleVelocities[i3] = (Math.random() - 0.5) * 10;
            particleVelocities[i3 + 1] = (Math.random() - 0.5) * 10;
            particleVelocities[i3 + 2] = (Math.random() - 0.5) * 10;
            
            // 设置粒子颜色
            const particleColor = new THREE.Color(color);
            particleColors[i3] = particleColor.r;
            particleColors[i3 + 1] = particleColor.g;
            particleColors[i3 + 2] = particleColor.b;
            
            particleSizes[i] = Math.random() * 3 + 1;
            particleLifetimes[i] = 1.0;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particles.setAttribute('velocity', new THREE.BufferAttribute(particleVelocities, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        particles.setAttribute('lifetime', new THREE.BufferAttribute(particleLifetimes, 1));

        const particleMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particleSystem = new THREE.Points(particles, particleMaterial);
        explosionGroup.add(particleSystem);

        // 添加到场景
        this.add(explosionGroup);
        this.explosionEffects.push({
            group: explosionGroup,
            startTime: Date.now(),
            duration: 3000,
            particleSystem,
            particles
        });

        // 设置自动清理
        setTimeout(() => {
            this.removeExplosionEffect(explosionGroup);
        }, 3000);

        console.log(`Created explosion effect at (${position.x}, ${position.y}, ${position.z})`);
    }

    /**
     * 移除爆炸特效
     * @param {THREE.Group} explosionGroup - 爆炸组
     */
    removeExplosionEffect(explosionGroup) {
        this.remove(explosionGroup);
        
        // 清理几何体和材质
        explosionGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        // 从数组中移除
        const index = this.explosionEffects.findIndex(effect => effect.group === explosionGroup);
        if (index !== -1) {
            this.explosionEffects.splice(index, 1);
        }
    }

    /**
     * 更新爆炸特效动画
     * @param {number} delta - 时间增量
     */
    updateExplosionEffects(delta) {
        this.explosionEffects.forEach(effect => {
            const elapsed = Date.now() - effect.startTime;
            const progress = elapsed / effect.duration;
            
            if (progress >= 1) return;

            const positions = effect.particles.attributes.position.array;
            const velocities = effect.particles.attributes.velocity.array;
            const lifetimes = effect.particles.attributes.lifetime.array;

            for (let i = 0; i < positions.length; i += 3) {
                const i3 = i / 3;
                
                // 更新位置
                positions[i] += velocities[i] * delta * 0.001;
                positions[i + 1] += velocities[i + 1] * delta * 0.001;
                positions[i + 2] += velocities[i + 2] * delta * 0.001;
                
                // 更新生命周期
                lifetimes[i3] -= delta * 0.001;
                
                // 应用重力
                velocities[i + 1] -= 9.8 * delta * 0.001;
            }

            effect.particles.attributes.position.needsUpdate = true;
            effect.particles.attributes.lifetime.needsUpdate = true;
            
            // 更新透明度
            effect.particleSystem.material.opacity = 1 - progress;
        });
    }

    /**
     * 根据国家名称获取3D坐标 - 修复：支持更多国家和动态查找
     * @param {string} countryName - 国家名称
     * @returns {Object|null} 3D坐标 {x, y, z} 或 null
     */
    getCountry3DPosition(countryName) {
        // 修复：扩展国家坐标映射，使用筛选后的45个Polygon大国
        const countryCoordinates = {
            // 亚洲大国（Polygon类型）
            'India': { lat: 20.5937, lng: 78.9629 },
            'Kazakhstan': { lat: 48.0196, lng: 66.9237 },
            'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
            'Iran': { lat: 32.4279, lng: 53.6880 },
            'Mongolia': { lat: 46.8625, lng: 103.8467 },
            'Myanmar': { lat: 21.9162, lng: 95.9560 },
            'Afghanistan': { lat: 33.9391, lng: 67.7100 },
            'Pakistan': { lat: 30.3753, lng: 69.3451 },
            'Thailand': { lat: 15.8700, lng: 100.9925 },
            'Turkmenistan': { lat: 38.9697, lng: 59.5563 },
            'Uzbekistan': { lat: 41.3775, lng: 64.5853 },
            
            // 欧洲大国（Polygon类型）
            'Ukraine': { lat: 48.3794, lng: 31.1656 },
            'Germany': { lat: 51.1657, lng: 10.4515 },
            'Spain': { lat: 40.4637, lng: -3.7492 },
            'Republic of Serbia': { lat: 44.0165, lng: 21.0059 },
            'Poland': { lat: 51.9194, lng: 19.1451 },
            
            // 南美洲大国（Polygon类型）
            'Brazil': { lat: -14.2350, lng: -51.9253 },
            'Colombia': { lat: 4.5709, lng: -74.2973 },
            'Venezuela': { lat: 6.4238, lng: -66.5897 },
            'Peru': { lat: -9.1900, lng: -75.0152 },
            'Bolivia': { lat: -16.2902, lng: -63.5887 },
            
            // 北美洲大国（Polygon类型）
            'Mexico': { lat: 23.6345, lng: -102.5528 },
            'Greenland': { lat: 71.7069, lng: -42.6043 },
            
            // 非洲大国（Polygon类型）
            'Democratic Republic of the Congo': { lat: -4.0383, lng: 21.7587 },
            'Sudan': { lat: 12.8628, lng: 30.2176 },
            'Algeria': { lat: 28.0339, lng: 1.6596 },
            'Libya': { lat: 26.3351, lng: 17.2283 },
            'Ethiopia': { lat: 9.1450, lng: 40.4897 },
            'Mali': { lat: 17.5707, lng: -3.9962 },
            'Niger': { lat: 17.6078, lng: 8.0817 },
            'Chad': { lat: 15.4542, lng: 18.7322 },
            'Nigeria': { lat: 9.0820, lng: 8.6753 },
            'Mozambique': { lat: -18.6657, lng: 35.5296 },
            
            // 中美洲大国（Polygon类型）
            'Honduras': { lat: 15.2000, lng: -86.2419 },
            'Nicaragua': { lat: 12.8654, lng: -85.2072 },
            'Panama': { lat: 8.5380, lng: -80.7821 }
        };

        // 修复：尝试多种名称匹配方式
        let coords = countryCoordinates[countryName];
        
        if (!coords) {
            // 尝试标准名称映射
            const standardName = this.getCountryStandardName(countryName);
            coords = countryCoordinates[standardName];
        }
        
        if (!coords) {
            console.warn(`Country coordinates not found for: ${countryName}`);
            console.log('Available countries:', Object.keys(countryCoordinates));
            return null;
        }

        const lat = coords.lat * Math.PI / 180;
        const lng = coords.lng * Math.PI / 180;
        
        const x = this.radius * Math.cos(lat) * Math.sin(lng);
        const y = this.radius * Math.sin(lat);
        const z = this.radius * Math.cos(lat) * Math.cos(lng);
        
        return { x, y, z };
    }
}