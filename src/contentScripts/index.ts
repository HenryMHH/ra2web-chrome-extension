import { onMessage } from 'webext-bridge/content-script'
import { injectScript } from './utils/dom'
import { onPageReady, pageCmd } from './utils/pageBridge'

const STORAGE_KEY = 'ra2NamesSettings'

interface StoredSettings {
  enabled?: boolean
  showNeutral?: boolean
  showIndicators?: boolean
  enabledCrateTypes?: number[]
  fontSize?: number
  hiddenUnits?: string[]
}

;(() => {
  // eslint-disable-next-line no-console
  console.info('[ra2-names] content script loaded')
  injectScript()

  // Auto-apply stored settings as soon as the page side announces ready.
  onPageReady(async () => {
    try {
      const obj = await browser.storage.local.get(STORAGE_KEY)
      const s = obj[STORAGE_KEY] as StoredSettings | undefined
      if (!s)
        return
      const active = !!(s.enabled || s.showIndicators || (s.enabledCrateTypes?.length ?? 0) > 0)
      if (!active)
        return
      const res = await pageCmd('apply', s)
      if (res.ok) {
        browser.runtime.sendMessage({ cmd: 'setIcon', active: true }).catch(() => {})
      }
    }
    catch (e) {
      console.warn('[ra2-names] auto-apply failed:', e)
    }
  })

  // Receive popup commands via webext-bridge.
  onMessage('ra2:apply', async ({ data }) => pageCmd('apply', data) as any)
  onMessage('ra2:status', async () => pageCmd('status') as any)
  onMessage('ra2:getUnitNames', async () => pageCmd('getUnitNames') as any)
})()
