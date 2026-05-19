import { overlayState } from '../state/overlay'

export function initOverlay(): void {
  if (overlayState.canvas)
    return
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999;'
  document.body.appendChild(canvas)
  overlayState.canvas = canvas
  overlayState.ctx = canvas.getContext('2d')
}

export function removeOverlay(): void {
  if (overlayState.rafId !== null) {
    cancelAnimationFrame(overlayState.rafId)
    overlayState.rafId = null
  }
  if (overlayState.canvas) {
    overlayState.canvas.remove()
    overlayState.canvas = null
    overlayState.ctx = null
  }
}
