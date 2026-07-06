import { sizes } from "./sizes"
let cameras: any[] = [], renderers: any[] = [], canvas: HTMLElement | null = null
function resizeEvent() {

    canvas = document.getElementById('webgl-container')

    // Update sizes
    if (!canvas) return
    sizes.width = canvas.clientWidth
    sizes.height = canvas.clientHeight

    try {
        // Update camera
        for (let i = 0; i < cameras.length; i++) {
            cameras[i].aspect = sizes.width / sizes.height
            cameras[i].updateProjectionMatrix()
        }
        // Update renderer
        for (let i = 0; i < renderers.length; i++) {
            renderers[i].setSize(sizes.width, sizes.height)
            renderers[i].setPixelRatio(Math.min(window.devicePixelRatio, 2))
        }
    } catch (error) {
        // console.log(error)
    }

}
export function initResizeEventListener(_cameras: any[] = [], _renderers: any[] = []){
    cameras = _cameras; renderers = _renderers;
    window.addEventListener('resize', resizeEvent)
}
export function clearResizeEventListener(){
    window.removeEventListener("resize", resizeEvent)
}
