import { runtime } from '../state/runtime'
import { log } from '../state/log'
import { loadFromSystemJs } from './loader-systemjs'
import { loadFromVite } from './loader-vite'

// Hosts whose bundle is Vite-packed (frozen module namespaces, no SystemJS).
// Anything not in this list falls through to the SystemJS loader.
export const VITE_HOST_SUFFIXES = ['wangerhuoda.cn'] as const

export function isViteHost(hostname: string): boolean {
  return VITE_HOST_SUFFIXES.some(h => hostname === h || hostname.endsWith(`.${h}`))
}

export async function loadClasses(): Promise<boolean> {
  if (runtime.PipOverlay && runtime.CanvasUtils)
    return true

  const host = location.hostname
  if (isViteHost(host)) {
    log(`loader: vite path (host=${host})`)
    return loadFromVite()
  }
  log(`loader: systemjs path (host=${host})`)
  return loadFromSystemJs()
}
