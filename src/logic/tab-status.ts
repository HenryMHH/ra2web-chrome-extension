import { ICONS } from '~/constants/icons'

const RA2_HOST_PATTERNS = [
  'game.chronodivide.com',
  'chronodivide.com',
  'ra2web.com',
]

function getIsRa2Url(url?: string) {
  // 當權限不足 or tab 還在初始化的時候， url 可能是 undefined
  if (!url)
    return false

  try {
    const { hostname } = new URL(url)
    return RA2_HOST_PATTERNS.some(p => hostname === p || hostname.endsWith(`.${p}`))
  }
  catch {
    return false
  }
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
