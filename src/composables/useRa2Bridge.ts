import { sendMessage } from 'webext-bridge/popup'
import type { ApplyOpts, ApplyResult } from '~/injectedScripts/types'

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

export function useRa2Bridge() {
  async function apply(opts: ApplyOpts): Promise<ApplyResult> {
    const tabId = await activeTabId()
    if (tabId == null)
      return { ok: false, error: 'no active tab' }
    return await sendMessage('ra2:apply', opts, { context: 'content-script', tabId }) as ApplyResult
  }
  async function status() {
    const tabId = await activeTabId()
    if (tabId == null)
      return { injected: false }
    return await sendMessage('ra2:status', undefined as any, { context: 'content-script', tabId })
  }
  async function getUnitNames(): Promise<{ units: Array<[string, string, string?]>, source: string }> {
    const tabId = await activeTabId()
    if (tabId == null)
      return { units: [], source: 'none' }
    return await sendMessage('ra2:getUnitNames', undefined as any, { context: 'content-script', tabId }) as any
  }

  return { apply, status, getUnitNames }
}
