import type { HandlerName } from './commands'
import { handlers } from './commands'

interface CmdMessage {
  __ra2names: 'cmd'
  id: number
  cmd: HandlerName
  opts?: any
}

interface ResMessage {
  __ra2names: 'res'
  id: number
  result: unknown
}

export function registerMessaging(): void {
  window.addEventListener('message', async (ev: MessageEvent) => {
    if (ev.source !== window)
      return
    const msg = ev.data as CmdMessage | undefined
    if (!msg || msg.__ra2names !== 'cmd')
      return
    let result: unknown
    try {
      const handler = handlers[msg.cmd] as ((opts?: any) => any) | undefined
      result = handler
        ? await handler(msg.opts ?? {})
        : { ok: false, error: 'unknown cmd' }
    }
    catch (e: any) {
      result = { ok: false, error: String(e?.message ?? e) }
    }
    const res: ResMessage = { __ra2names: 'res', id: msg.id, result }
    window.postMessage(res, '*')
  })
}

export function announceReady(): void {
  window.postMessage({ __ra2names: 'ready' }, '*')
}
