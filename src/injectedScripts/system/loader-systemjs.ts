import { runtime } from '../state/runtime'
import { warn } from '../state/log'
import { patchCrateTrait } from './patch-crate-trait'

declare const System: { import: (name: string) => Promise<any> } | undefined

const MODULES = {
  PipOverlay: 'engine/renderable/entity/PipOverlay',
  CanvasUtils: 'engine/gfx/CanvasUtils',
  SpriteUtils: 'engine/gfx/SpriteUtils',
  Coords: 'game/Coords',
  CrateTrait: 'game/trait/CrateGeneratorTrait',
} as const

export async function loadFromSystemJs(): Promise<boolean> {
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
