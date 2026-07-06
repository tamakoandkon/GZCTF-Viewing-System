declare module "../src/scene.js" {
  export function initScene(): { dispose: () => void }
}

interface ScenePerfMetrics {
  fps: number
  frameTime: number
  drawCalls: number
  triangles: number
  points: number
}

declare global {
  interface Window {
    __scenePerfMetrics?: ScenePerfMetrics
    __sceneRenderer?: any
  }
}

export {}

