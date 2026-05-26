import { runtime } from '../state/runtime'
import { warn } from '../state/log'
import { patchCrateTrait } from './patch-crate-trait'

interface ViteStash {
  PipOverlay?: any
  CanvasUtils?: any
  SpriteUtils?: any
  Coords?: any
  CrateGeneratorTrait?: any
}

const REQUIRED = ['PipOverlay', 'CanvasUtils', 'SpriteUtils', 'Coords', 'CrateGeneratorTrait'] as const

function readStash(): ViteStash | undefined {
  return (window as any).__ra2_runtime as ViteStash | undefined
}

function hasAll(s: ViteStash | undefined): s is Required<ViteStash> {
  if (!s)
    return false
  return REQUIRED.every(k => s[k] !== undefined)
}

async function waitForStash(timeoutMs: number): Promise<Required<ViteStash> | undefined> {
  const present = readStash()
  if (hasAll(present))
    return present

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>
    const handler = () => {
      const s = readStash()
      if (!hasAll(s))
        return
      window.removeEventListener('ra2-runtime-ready', handler)
      clearTimeout(timer)
      resolve(s)
    }
    timer = setTimeout(() => {
      window.removeEventListener('ra2-runtime-ready', handler)
      const s = readStash()
      resolve(hasAll(s) ? s : undefined)
    }, timeoutMs)
    window.addEventListener('ra2-runtime-ready', handler)
  })
}

export async function loadFromVite(): Promise<boolean> {
  const stash = await waitForStash(10_000)
  if (!stash) {
    warn('Vite stash missing — earlySniff did not capture all targets')
    return false
  }

  runtime.PipOverlay = stash.PipOverlay
  runtime.CanvasUtils = stash.CanvasUtils
  runtime.SpriteUtils = stash.SpriteUtils
  runtime.Coords = stash.Coords

  patchCrateTrait(stash.CrateGeneratorTrait)

  return !!(runtime.PipOverlay && runtime.CanvasUtils && runtime.SpriteUtils && runtime.Coords)
}
