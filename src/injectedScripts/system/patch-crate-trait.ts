import { runtime } from '../state/runtime'
import { tracking } from '../state/tracking'
import { log } from '../state/log'

// Shared CrateGeneratorTrait prototype patch. Both SystemJS (ra2web) and Vite
// (werhd) bundles expose the same class shape; only the way we obtain the class
// reference differs.
export function patchCrateTrait(CrateGeneratorTrait: any): void {
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
