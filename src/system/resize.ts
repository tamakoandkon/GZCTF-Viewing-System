import { sizes } from "./sizes"

let cameras: any[] = []
let renderers: any[] = []
let canvas: HTMLCanvasElement | null = null
let resizeObserver: ResizeObserver | null = null

function measureCanvas(): { width: number; height: number } | null {
    const nextCanvas = document.getElementById('webgl') as HTMLCanvasElement | null
    if (!nextCanvas) return null

    canvas = nextCanvas
    const container = nextCanvas.parentElement ?? document.body
    return {
        width: Math.max(container.clientWidth, 300),
        height: Math.max(container.clientHeight, 200),
    }
}

function resizeEvent() {
    const size = measureCanvas()
    if (!size) return

    sizes.width = size.width
    sizes.height = size.height

    for (const camera of cameras) {
        camera.aspect = sizes.width / sizes.height
        camera.updateProjectionMatrix()
    }

    for (const renderer of renderers) {
        renderer.setSize(sizes.width, sizes.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }
}

export function initResizeEventListener(_cameras: any[] = [], _renderers: any[] = []) {
    cameras = _cameras
    renderers = _renderers
    window.addEventListener('resize', resizeEvent)

    const canvasElement = document.getElementById('webgl')
    const container = canvasElement?.parentElement
    if (container && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resizeEvent)
        resizeObserver.observe(container)
    }
}

export function clearResizeEventListener() {
    window.removeEventListener('resize', resizeEvent)
    resizeObserver?.disconnect()
    resizeObserver = null
    cameras = []
    renderers = []
    canvas = null
}
