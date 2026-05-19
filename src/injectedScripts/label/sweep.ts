import { overlayState } from '../state/overlay'
import { warn } from '../state/log'

declare const THREE: any

export function sweepLeftoverLabels(): Promise<number> {
  if (typeof THREE === 'undefined' || !THREE.WebGLRenderer)
    return Promise.resolve(0)
  if (overlayState.sweepPromise)
    return overlayState.sweepPromise

  overlayState.sweepPromise = new Promise<number>((resolve) => {
    const origRender = THREE.WebGLRenderer.prototype.render
    let done = false

    THREE.WebGLRenderer.prototype.render = function (scene: any, ...rest: any[]) {
      if (!done) {
        done = true
        THREE.WebGLRenderer.prototype.render = origRender
        try {
          let root = scene
          if (root && !root.isScene) {
            let n = root
            while (n.parent) n = n.parent
            root = n
          }
          let removed = 0
          if (root) {
            const victims: any[] = []
            root.traverse((o: any) => {
              if (o?.userData?.__unameLbl)
                victims.push(o)
            })
            victims.forEach((o) => {
              o.userData.__unameLblDisposer?.()
              if (o.parent)
                o.parent.remove(o)
              removed++
            })
          }
          resolve(removed)
        }
        catch (e) {
          warn('sweep failed:', e)
          resolve(0)
        }
      }
      return origRender.call(this, scene, ...rest)
    }

    setTimeout(() => {
      if (!done) {
        THREE.WebGLRenderer.prototype.render = origRender
        resolve(0)
      }
    }, 2000)
  }).finally(() => {
    overlayState.sweepPromise = null
  })

  return overlayState.sweepPromise!
}
