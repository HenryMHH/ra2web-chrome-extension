import { onMessage } from 'webext-bridge/content-script'
import { startPlayerTags } from './playerTags'
import { injectScript } from './utils/dom'
import { onPageReady, pageCmd } from './utils/pageBridge'

const STORAGE_KEY = 'ra2NamesSettings'

interface StoredSettings {
  enabled?: boolean
  showNeutral?: boolean
  showIndicators?: boolean
  enabledCrateTypes?: number[]
  fontSize?: number
  shownUnitsCustom?: 'all' | string[]
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
      const res = await pageCmd('apply', { ...s, shownUnits: s.shownUnitsCustom ?? 'all' })
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

  // Player tags is a self-contained, best-effort feature: it must never take down the bridge
  // wiring above (e.g. a synchronous throw from observer.observe() on a frame with no <body>
  // yet), so it starts last and is isolated in its own try/catch.
  try {
    startPlayerTags()
  }
  catch (e) {
    console.warn('[ra2-names] player tags failed to start:', e)
  }
})()
