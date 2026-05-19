import type { Tabs } from 'webextension-polyfill'
import { ICONS } from '~/constants/icons'
import { initIcon, updateIcon } from '~/logic/tab-status'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

// remove or turn this off if you don't use side panel
const USE_SIDE_PANEL = true

// to toggle the sidepanel with the action button in chromium:
if (USE_SIDE_PANEL) {
  // @ts-expect-error missing types
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error(error))
}

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log('Extension installed')
})

browser.runtime.onMessage.addListener((msg: any, sender): undefined => {
  if (!msg || msg.cmd !== 'setIcon')
    return
  const tabId = sender.tab?.id
  const path = msg.active ? ICONS.active : ICONS.inactive
  if (tabId != null)
    browser.action.setIcon({ tabId, path: path as any }).catch(() => {})
  else
    browser.action.setIcon({ path: path as any }).catch(() => {})
})

let previousTabId = 0

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  updateIcon(tabId)

  if (!previousTabId) {
    previousTabId = tabId
    return
  }

  let tab: Tabs.Tab

  try {
    tab = await browser.tabs.get(previousTabId)

    previousTabId = tabId
  }
  catch {
    return
  }

  // eslint-disable-next-line no-console
  console.log('previous tab', tab)
  // sendMessage(
  //   "tab-prev",
  //   { title: tab.title },
  //   { context: "content-script", tabId },
  // );
})

browser.tabs.onUpdated.addListener(async (tabId) => {
  await updateIcon(tabId)
})

initIcon()
