export interface CameraKeyframe {
    time: number;
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
}

export interface CameraPreset {
    name: string;
    duration: number;
    keyframes: CameraKeyframe[];
}

export const CAMERA_PRESETS: Record<string, CameraPreset> = {
    // 环绕地球运镜
    orbit: {
        name: "环绕地球",
        duration: 10,
        keyframes: [
            { time: 0, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
            { time: 1.25, position: { x: 282.8, y: 75, z: -282.8 }, target: { x: 0, y: 0, z: 0 } },
            { time: 2.5, position: { x: 400, y: 100, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            { time: 3.75, position: { x: 282.8, y: 150, z: 282.8 }, target: { x: 0, y: 0, z: 0 } },
            { time: 5, position: { x: 0, y: 200, z: 400 }, target: { x: 0, y: 0, z: 0 } },
            { time: 6.25, position: { x: -282.8, y: 150, z: 282.8 }, target: { x: 0, y: 0, z: 0 } },
            { time: 7.5, position: { x: -400, y: 100, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            { time: 8.75, position: { x: -282.8, y: 75, z: -282.8 }, target: { x: 0, y: 0, z: 0 } },
            { time: 10, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
        ],
    },
    zoomIn: {
        name: "推进特写",
        duration: 10,
        keyframes: [
            { time: 0, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
            { time: 3, position: { x: 100, y: 50, z: -300 }, target: { x: 50, y: 0, z: 0 } },
            { time: 6, position: { x: 150, y: 50, z: -200 }, target: { x: 100, y: 0, z: 0 } },
            { time: 8, position: { x: 200, y: 50, z: -150 }, target: { x: 150, y: 0, z: 0 } },
            { time: 10, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
        ],
    },
    dive: {
        name: "俯冲运镜",
        duration: 10,
        keyframes: [
            { time: 0, position: { x: 0, y: 300, z: -400 }, target: { x: 0, y: 0, z: 0 } },
            { time: 2, position: { x: 0, y: 200, z: -300 }, target: { x: 0, y: 0, z: 0 } },
            { time: 4, position: { x: 0, y: 100, z: -200 }, target: { x: 0, y: 0, z: 0 } },
            { time: 6, position: { x: 0, y: 50, z: -150 }, target: { x: 0, y: 0, z: 0 } },
            { time: 8, position: { x: 0, y: 150, z: -250 }, target: { x: 0, y: 0, z: 0 } },
            { time: 10, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
        ],
    },
    spiral: {
        name: "螺旋上升",
        duration: 10,
        keyframes: [
            { time: 0, position: { x: 300, y: 50, z: -300 }, target: { x: 0, y: 0, z: 0 } },
            { time: 2, position: { x: 200, y: 150, z: -200 }, target: { x: 0, y: 0, z: 0 } },
            { time: 4, position: { x: 0, y: 250, z: -200 }, target: { x: 0, y: 0, z: 0 } },
            { time: 6, position: { x: -200, y: 150, z: -200 }, target: { x: 0, y: 0, z: 0 } },
            { time: 8, position: { x: -300, y: 50, z: -300 }, target: { x: 0, y: 0, z: 0 } },
            { time: 10, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
        ],
    },
    followSpaceship: {
        name: "跟随飞船",
        duration: 10,
        keyframes: [
            { time: 0, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
            { time: 2, position: { x: 200, y: 50, z: -300 }, target: { x: 150, y: 0, z: 0 } },
            { time: 4, position: { x: 300, y: 50, z: -200 }, target: { x: 250, y: 0, z: 0 } },
            { time: 6, position: { x: 200, y: 50, z: -100 }, target: { x: 150, y: 0, z: 0 } },
            { time: 8, position: { x: 0, y: 50, z: -200 }, target: { x: 0, y: 0, z: 0 } },
            { time: 10, position: { x: 0, y: 50, z: -400 }, target: { x: 0, y: 0, z: 0 } },
        ],
    },
};
