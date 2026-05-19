import { ref } from 'vue'
import type { Tabs } from 'webextension-polyfill'

export function useCurrentUrl() {
  const url = ref('')

  const refresh = async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    url.value = tab?.url || ''
  }

  const onUpdated = (
    _tabId: number,
    info: Tabs.OnUpdatedChangeInfoType,
    tab: Tabs.Tab,
  ) => {
    if (info.url && tab.active)
      refresh()
  }

  onMounted(() => {
    refresh()
    browser.tabs.onActivated.addListener(refresh)
    browser.tabs.onUpdated.addListener(onUpdated)
  })

  onUnmounted(() => {
    browser.tabs.onActivated.removeListener(refresh)
    browser.tabs.onUpdated.removeListener(onUpdated)
  })

  return url
}
