import type { Vector3 } from 'three'
import { runtime } from '../state/runtime'
import { settings } from '../state/settings'
import { tracking } from '../state/tracking'
import { overlayState } from '../state/overlay'
import { invertM4 } from '../system/three-compat'
import { drawIndicators } from './indicators'
import { drawCrateLabels } from './crates'

declare const THREE: any

let tmpV3: Vector3 | null = null

export function drawOverlay(): void {
  if (!settings.showIndicators && settings.enabledCrateTypes.size === 0) {
    overlayState.rafId = null
    return
  }
  overlayState.rafId = requestAnimationFrame(drawOverlay)
  if (!overlayState.canvas || !runtime.activeCamera)
    return
  if (!tmpV3)
    tmpV3 = new THREE.Vector3()

  const canvas = overlayState.canvas
  const ctx = overlayState.ctx!
  const W = window.innerWidth
  const H = window.innerHeight
  if (canvas.width !== W)
    canvas.width = W
  if (canvas.height !== H)
    canvas.height = H
  ctx.clearRect(0, 0, W, H)

  if (tracking.lastPipUpdateTime > 0 && performance.now() - tracking.lastPipUpdateTime > 2000)
    return

  const camera = runtime.activeCamera
  camera.updateMatrixWorld()
  invertM4(camera.matrixWorldInverse, camera.matrixWorld)

  if (settings.showIndicators)
    drawIndicators(ctx, W, H, camera, tmpV3!)
  if (settings.enabledCrateTypes.size > 0)
    drawCrateLabels(ctx, W, H, camera, tmpV3!)
}
