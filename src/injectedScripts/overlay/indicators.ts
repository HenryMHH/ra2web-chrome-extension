import type * as THREE from 'three'
import { resolveNameFromGo } from '../pip/resolvers'
import { runtime } from '../state/runtime'
import { settings } from '../state/settings'

const MARGIN = 24
const ARROW_HALF = 10
const LABEL_FS = 11
const PX = 5
const PY = 3

export function drawIndicators(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camera: THREE.Camera,
  tmpV3: THREE.Vector3,
): void {
  if (!runtime.alliances || !runtime.viewer)
    return
  const local = runtime.viewer.value
  const players = runtime.alliances.playerList?.players
  if (!players)
    return
  const cx = W / 2
  const cy = H / 2

  for (const player of players) {
    if (player === local || player.isNeutral || runtime.alliances.areAllied(player, local))
      continue
    try {
      for (const go of player.getOwnedObjects()) {
        if (go.isDestroyed || !go.position)
          continue
        if (settings.hiddenUnits.size > 0
          && settings.hiddenUnits.has(go.rules?.name?.toUpperCase() ?? '')) {
          continue
        }
        try {
          const wp = go.position.worldPosition
          tmpV3.set(wp.x, wp.y, wp.z)
          tmpV3.project(camera)

          const sx = (tmpV3.x + 1) / 2 * W
          const sy = (-tmpV3.y + 1) / 2 * H
          if (sx >= MARGIN && sx <= W - MARGIN && sy >= MARGIN && sy <= H - MARGIN)
            continue

          const angle = Math.atan2(sy - cy, sx - cx)
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          const scaleX = cos !== 0 ? (W / 2 - MARGIN) / Math.abs(cos) : Infinity
          const scaleY = sin !== 0 ? (H / 2 - MARGIN) / Math.abs(sin) : Infinity
          const scale = Math.min(scaleX, scaleY)
          const ex = cx + cos * scale
          const ey = cy + sin * scale

          ctx.save()
          ctx.translate(ex, ey)
          ctx.rotate(angle)
          ctx.beginPath()
          ctx.moveTo(ARROW_HALF, 0)
          ctx.lineTo(-ARROW_HALF, -ARROW_HALF * 0.6)
          ctx.lineTo(-ARROW_HALF * 0.4, 0)
          ctx.lineTo(-ARROW_HALF, ARROW_HALF * 0.6)
          ctx.closePath()
          ctx.fillStyle = 'rgba(210,30,30,0.9)'
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'
          ctx.lineWidth = 1.5
          ctx.fill()
          ctx.stroke()
          ctx.restore()

          const goName = resolveNameFromGo(go)
          if (goName) {
            ctx.save()
            ctx.font = `600 ${LABEL_FS}px 'Fira Sans Condensed', Arial, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            const tw = ctx.measureText(goName).width
            const lw = tw + PX * 2
            const lh = LABEL_FS + PY * 2
            const lx = Math.max(1, Math.min(ex - lw / 2, W - lw - 1))
            const lyRaw = ey + ARROW_HALF + 4
            const ly = Math.min(lyRaw, H - lh - 1)
            ctx.fillStyle = 'rgba(210,30,30,0.9)'
            ctx.fillRect(lx, ly, lw, lh)
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'
            ctx.lineWidth = 1
            ctx.strokeRect(lx, ly, lw, lh)
            ctx.fillStyle = 'white'
            ctx.fillText(goName, lx + lw / 2, ly + PY)
            ctx.restore()
          }
        }
        catch { /* skip bad go */ }
      }
    }
    catch { /* skip bad player */ }
  }
}
