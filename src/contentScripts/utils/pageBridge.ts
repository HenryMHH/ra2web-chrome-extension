export interface PageResponse<T = any> {
  ok: boolean
  error?: string
  result?: T
  [k: string]: any
}

interface CmdEnvelope { __ra2names: 'cmd', id: number, cmd: string, opts?: any }
interface ResEnvelope { __ra2names: 'res', id: number, result: PageResponse }
interface ReadyEnvelope { __ra2names: 'ready' }

const pending = new Map<number, (r: PageResponse) => void>()
let seq = 0
const READY_LISTENERS = new Set<() => void>()

export function onPageReady(cb: () => void): () => void {
  READY_LISTENERS.add(cb)
  return () => {
    READY_LISTENERS.delete(cb)
  }
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window)
    return
  const msg = ev.data as ResEnvelope | ReadyEnvelope | undefined
  if (!msg || (msg as any).__ra2names == null)
    return
  if (msg.__ra2names === 'res') {
    const id = (msg as ResEnvelope).id
    const r = pending.get(id)
    if (r) {
      pending.delete(id)
      r((msg as ResEnvelope).result)
    }
  }
  else if (msg.__ra2names === 'ready') {
    READY_LISTENERS.forEach((fn) => {
      try {
        fn()
      }
      catch {}
    })
  }
})

export function pageCmd<T = any>(cmd: string, opts?: any, timeoutMs = 3000): Promise<PageResponse<T>> {
  return new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    const env: CmdEnvelope = { __ra2names: 'cmd', id, cmd, opts }
    window.postMessage(env, '*')
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        resolve({ ok: false, error: 'timeout' })
      }
    }, timeoutMs)
  })
}
