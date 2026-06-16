import type * as THREE from 'three'
import { runtime } from '../state/runtime'
import { settings } from '../state/settings'
import { getCratePoolOrdered } from '../rules/enumerate'
import { clonePrng, predictUnitCrate } from './prng-predict'
import { POWERUP_LABELS } from '~/constants/powerups'

const LABEL_FS = 11
const PX = 5
const PY = 3
const POWERUP_TYPE_UNIT = 7

function resolveUnitDisplayName(ruleName: string): string {
  try {
    const rule = runtime.gameRef?.rules?.vehicleRules?.get(ruleName)
    if (!rule?.uiName)
      return ruleName
    return runtime.strings?.get(rule.uiName) || ruleName
  }
  catch {
    return ruleName
  }
}

export function drawCrateLabels(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  camera: THREE.Camera,
  tmpV3: THREE.Vector3,
): void {
  if (!runtime.crateTraitRef)
    return
  const crates = runtime.crateTraitRef.crates
  if (!crates || crates.length === 0)
    return
  const Coords = runtime.Coords
  if (!Coords)
    return

  // Compute unit prediction once per frame (same PRNG state for all unit crates)
  let unitPredictionLabel: string | null = null
  if (settings.enabledCrateTypes.has(POWERUP_TYPE_UNIT)) {
    const pool = getCratePoolOrdered()
    const prng = runtime.gameRef?.prng
    if (pool.length > 0 && prng) {
      const clone = clonePrng(prng)
      const ruleName = clone ? predictUnitCrate(clone, pool) : null
      if (ruleName)
        unitPredictionLabel = resolveUnitDisplayName(ruleName)
    }
  }

  for (const crate of crates) {
    const obj = crate.obj
    if (!obj || !obj.tile)
      continue
    const powerupType = crate.powerup?.type
    if (!settings.enabledCrateTypes.has(Number(powerupType)))
      continue

    let label: string
    if (powerupType === POWERUP_TYPE_UNIT && unitPredictionLabel) {
      label = unitPredictionLabel
    }
    else {
      label = POWERUP_LABELS[powerupType]
      if (!label)
        continue
    }

    let sx: number
    let sy: number
    try {
      let wx: number
      let wy: number
      let wz: number
      const wp = obj.position?.worldPosition
      if (wp) {
        wx = wp.x
        wy = wp.y
        wz = wp.z
      }
      else {
        const tile = obj.tile
        const v3 = Coords.tile3dToWorld(tile.rx + 0.5, tile.ry + 0.5, tile.z || 0)
        wx = v3.x
        wy = v3.y
        wz = v3.z
      }
      tmpV3.set(wx, wy, wz)
      tmpV3.project(camera)
      sx = (tmpV3.x + 1) / 2 * W
      sy = (-tmpV3.y + 1) / 2 * H
      if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20)
        continue
    }
    catch { continue }

    ctx.save()
    try {
      ctx.font = `600 ${LABEL_FS}px 'Fira Sans Condensed', Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      const tw = ctx.measureText(label).width
      const lw = tw + PX * 2
      const lh = LABEL_FS + PY * 2
      const lx = Math.max(1, Math.min(sx - lw / 2, W - lw - 1))
      const ly = Math.max(0, sy - 18)
      ctx.fillStyle = 'rgba(200,155,0,0.92)'
      ctx.fillRect(lx, ly, lw, lh)
      ctx.strokeStyle = 'rgba(255,230,100,0.7)'
      ctx.lineWidth = 1
      ctx.strokeRect(lx, ly, lw, lh)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, lx + lw / 2, ly + lh - PY)
    }
    finally {
      ctx.restore()
    }
  }
}
