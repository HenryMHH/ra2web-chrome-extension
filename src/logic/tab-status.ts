import { ICONS } from '~/constants/icons'

function getIsRa2Url(url?: string) {
  // 當權限不足 or tab 還在初始化的時候， url 可能是 undefined
  if (!url)
    return false

  return url.includes('https://game.ra2web.com')
}

export async function updateIcon(tabId: number) {
  try {
    const tab = await browser.tabs.get(tabId)

    const isRa2Url = getIsRa2Url(tab.url)

    if (isRa2Url) {
      browser.action.setIcon({
        tabId: tab.id,
        path: ICONS.active,
      })
    }
    else {
      browser.action.setIcon({
        tabId: tab.id,
        path: ICONS.inactive,
      })
    }
  }
  catch {
    // ignore tab query failures
  }
}

export async function initIcon() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

  if (tab?.id)
    updateIcon(tab.id)
}
