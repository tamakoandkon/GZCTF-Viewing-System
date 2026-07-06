export default class PerfRecorder {
    active: boolean
    session: any
    getCamera: () => any
    getControls: () => any
    getRenderer: () => any
    _last: any

    constructor({ getCamera, getControls, getRenderer }: any = {}) {
        this.getCamera = getCamera
        this.getControls = getControls
        this.getRenderer = getRenderer
        this.active = false
        this.session = null
        this._last = {
            t: 0,
            cam: { x: 0, y: 0, z: 0 },
            tgt: { x: 0, y: 0, z: 0 }
        }
    }

    start(opts: any = {}) {
        const { name = 'session', meta = {} } = opts
        const now: number = performance.now()
        const camera: any = this.getCamera?.()
        const controls: any = this.getControls?.()
        const renderer: any = this.getRenderer?.()
        const info: any = renderer?.info

        this.active = true
        this.session = {
            name,
            startedAt: now,
            meta,
            env: {
                href: location?.href,
                ua: navigator?.userAgent,
                dpr: window?.devicePixelRatio,
                size: { w: window?.innerWidth, h: window?.innerHeight }
            },
            frames: [],
            spikes: [],
            baseline: {
                drawCalls: info?.render?.calls ?? null,
                triangles: info?.render?.triangles ?? null
            }
        }

        if (camera) {
            this._last.cam.x = camera.position.x
            this._last.cam.y = camera.position.y
            this._last.cam.z = camera.position.z
        }
        if (controls) {
            this._last.tgt.x = controls.target.x
            this._last.tgt.y = controls.target.y
            this._last.tgt.z = controls.target.z
        }
        this._last.t = now
    }

    sample(opts: any = {}) {
        const { dt, cpuMs = null } = opts
        if (!this.active || !this.session) return

        const now = performance.now()
        const camera: any = this.getCamera?.()
        const controls: any = this.getControls?.()
        const renderer: any = this.getRenderer?.()
        const info: any = renderer?.info

        const cam = camera?.position
        const tgt = controls?.target

        let camDx = 0, camDy = 0, camDz = 0, camD = 0
        if (cam) {
            camDx = cam.x - this._last.cam.x
            camDy = cam.y - this._last.cam.y
            camDz = cam.z - this._last.cam.z
            camD = Math.sqrt(camDx * camDx + camDy * camDy + camDz * camDz)
            this._last.cam.x = cam.x
            this._last.cam.y = cam.y
            this._last.cam.z = cam.z
        }

        let tgtDx = 0, tgtDy = 0, tgtDz = 0, tgtD = 0
        if (tgt) {
            tgtDx = tgt.x - this._last.tgt.x
            tgtDy = tgt.y - this._last.tgt.y
            tgtDz = tgt.z - this._last.tgt.z
            tgtD = Math.sqrt(tgtDx * tgtDx + tgtDy * tgtDy + tgtDz * tgtDz)
            this._last.tgt.x = tgt.x
            this._last.tgt.y = tgt.y
            this._last.tgt.z = tgt.z
        }

        const mem = (performance as any)?.memory
            ? {
                jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize
            }
            : null

        const frame: any = {
            t: now,
            sinceStart: now - this.session.startedAt,
            dt,
            cpuMs,
            cam: cam ? { x: cam.x, y: cam.y, z: cam.z } : null,
            tgt: tgt ? { x: tgt.x, y: tgt.y, z: tgt.z } : null,
            camD,
            tgtD,
            drawCalls: info?.render?.calls ?? null,
            triangles: info?.render?.triangles ?? null,
            mem
        }

        this.session.frames.push(frame)

        if (camD > 0.5 || tgtD > 0.5 || (typeof dt === 'number' && dt > 1 / 30) || (typeof cpuMs === 'number' && cpuMs > 16.7)) {
            this.session.spikes.push(frame)
        }

        this._last.t = now
    }

    stop(opts: any = {}): any {
        const { download = true } = opts
        if (!this.active || !this.session) return null

        const endedAt = performance.now()
        const session: any = this.session
        session.endedAt = endedAt
        session.durationMs = endedAt - session.startedAt

        const frames: any[] = session.frames
        if (frames.length) {
            let dtSum = 0, dtMin = Infinity, dtMax = 0, cpuMax = 0, camDMax = 0, tgtDMax = 0
            for (let i = 0; i < frames.length; i++) {
                const f = frames[i]
                const dtVal = typeof f.dt === 'number' ? f.dt : 0
                dtSum += dtVal
                if (dtVal > 0 && dtVal < dtMin) dtMin = dtVal
                if (dtVal > dtMax) dtMax = dtVal
                if (typeof f.cpuMs === 'number' && f.cpuMs > cpuMax) cpuMax = f.cpuMs
                if (typeof f.camD === 'number' && f.camD > camDMax) camDMax = f.camD
                if (typeof f.tgtD === 'number' && f.tgtD > tgtDMax) tgtDMax = f.tgtD
            }
            const dtAvg = dtSum / frames.length
            session.summary = {
                frameCount: frames.length,
                dtAvg,
                dtMin: dtMin < Infinity ? dtMin : null,
                dtMax,
                fpsAvg: dtAvg > 0 ? 1 / dtAvg : null,
                fpsMin: dtMax > 0 ? 1 / dtMax : null,
                fpsMax: dtMin < Infinity && dtMin > 0 ? 1 / dtMin : null,
                cpuMax,
                camDMax,
                tgtDMax,
                spikeWindow: session.spikes.length ? {
                    firstSinceStart: session.spikes[0].sinceStart,
                    lastSinceStart: session.spikes[session.spikes.length - 1].sinceStart,
                    count: session.spikes.length
                } : null
            }
        }

        this.active = false
        this.session = null

        if (download) {
            const fileName = `top3-showcase-perf-${Date.now()}.json`
            const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        }

        return session
    }
}
