export interface OverlayState {
  canvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D | null
  rafId: number | null
  sweepPromise: Promise<number> | null
}

export const overlayState: OverlayState = {
  canvas: null,
  ctx: null,
  rafId: null,
  sweepPromise: null,
}
