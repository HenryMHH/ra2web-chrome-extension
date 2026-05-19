import { runtime } from '../state/runtime'
import { tracking } from '../state/tracking'
import { log, warn } from '../state/log'

declare const System: { import: (name: string) => Promise<any> } | undefined

const MODULES = {
  PipOverlay: 'engine/renderable/entity/PipOverlay',
  CanvasUtils: 'engine/gfx/CanvasUtils',
  SpriteUtils: 'engine/gfx/SpriteUtils',
  Coords: 'game/Coords',
  CrateTrait: 'game/trait/CrateGeneratorTrait',
} as const

export async function loadClasses(): Promise<boolean> {
  if (runtime.PipOverlay && runtime.CanvasUtils)
    return true
  if (typeof System === 'undefined' || !System.import)
    return false

  try {
    const [P, CU, SU, CO, CGT] = await Promise.all([
      System.import(MODULES.PipOverlay),
      System.import(MODULES.CanvasUtils),
      System.import(MODULES.SpriteUtils),
      System.import(MODULES.Coords),
      System.import(MODULES.CrateTrait),
    ])

    runtime.PipOverlay = P.PipOverlay
    runtime.CanvasUtils = CU.CanvasUtils
    runtime.SpriteUtils = SU.SpriteUtils
    runtime.Coords = CO.Coords

    patchCrateTrait(CGT.CrateGeneratorTrait)

    return !!(runtime.PipOverlay && runtime.CanvasUtils && runtime.SpriteUtils && runtime.Coords)
  }
  catch (e) {
    warn('System.import failed:', e)
    return false
  }
}

function patchCrateTrait(CrateGeneratorTrait: any): void {
  const proto = CrateGeneratorTrait.prototype

  const origInit = proto.init
  proto.init = function (game: any) {
    runtime.crateTraitRef = this
    runtime.gameRef = game ?? null
    tracking.discoveredUnits.clear()
    // eslint-disable-next-line prefer-rest-params
    return origInit.apply(this, arguments as any)
  }

  const origSpawn = proto.spawnCrateAt
  proto.spawnCrateAt = function (...args: any[]) {
    if (!runtime.crateTraitRef)
      runtime.crateTraitRef = this
    if (!runtime.gameRef && args[2])
      runtime.gameRef = args[2]
    return origSpawn.apply(this, args)
  }

  log('CrateGeneratorTrait patched')
}
