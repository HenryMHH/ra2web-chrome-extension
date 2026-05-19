import type { LabelCache, PipOverlayLike, Team } from '../types'
import { resolveName, resolveTeam } from '../pip/resolvers'
import { runtime } from '../state/runtime'
import { settings } from '../state/settings'

declare const THREE: any

const TEAM_BG: Record<Team, string> = {
  enemy: 'rgba(160,0,0,0.88)',
  self: 'rgba(0,50,160,0.88)',
  ally: 'rgba(0,50,160,0.88)',
  neutral: 'rgba(0,130,50,0.88)',
  unknown: 'rgba(70,70,70,0.88)',
}

export function buildLabel(self: PipOverlayLike): LabelCache | null {
  const name = resolveName(self)
  if (!name)
    return null
  if (!runtime.CanvasUtils || !runtime.SpriteUtils || !runtime.Coords)
    return null
  if (typeof THREE === 'undefined' || !self.camera)
    return null

  const team = resolveTeam(self)
  const bgColor = TEAM_BG[team]

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 0
  const ctx = canvas.getContext('2d')!
  let y = 0
  for (const line of name.split('\n')) {
    const metrics = runtime.CanvasUtils.drawText(ctx, line, 0, y, {
      color: 'white',
      backgroundColor: bgColor,
      outlineColor: 'rgba(0,0,0,0.45)',
      outlineWidth: 1,
      fontFamily: '\'Fira Sans Condensed\', Arial, sans-serif',
      fontSize: settings.fontSize,
      fontWeight: '400',
      paddingTop: 3,
      paddingBottom: 3,
      paddingLeft: 5,
      paddingRight: 5,
      autoEnlargeCanvas: true,
    })
    y += metrics.height
  }

  // autoEnlargeCanvas resizes and clears pixels — back up then shift (1,1) to preserve them.
  const w = canvas.width
  const h = canvas.height
  const imgData = ctx.getImageData(0, 0, w, h)
  canvas.width += 1
  canvas.height += 1
  ctx.putImageData(imgData, 1, 1)

  const tex = new THREE.Texture(canvas)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.needsUpdate = true
  tex.flipY = true

  const Coords = runtime.Coords
  const geom = runtime.SpriteUtils.createSpriteGeometry({
    texture: tex,
    camera: self.camera,
    align: { x: 0, y: -1 },
    offset: { x: 0, y: Coords.ISO_TILE_SIZE / 4 },
    scale: Coords.ISO_WORLD_SCALE,
  })
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.matrixAutoUpdate = false
  mesh.renderOrder = 999998
  mesh.userData.__unameLbl = true
  const dispose = () => {
    tex.dispose()
    mat.dispose()
    geom.dispose()
  }
  mesh.userData.__unameLblDisposer = dispose

  return {
    mesh,
    dispose,
    text: name,
    owner: self.gameObject?.owner,
    team,
    fontSize: settings.fontSize,
  }
}
