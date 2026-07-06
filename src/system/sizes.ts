export const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
}

export const initSizes = (canvas: HTMLElement) => {
    // 获取canvas容器的实际尺寸
    const container = canvas.parentElement || document.body
    sizes.width = container.clientWidth
    sizes.height = container.clientHeight

    // 确保最小尺寸
    sizes.width = Math.max(sizes.width, 300)
    sizes.height = Math.max(sizes.height, 200)

    // 设置canvas的CSS尺寸
    canvas.style.width = sizes.width + 'px'
    canvas.style.height = sizes.height + 'px'
}
