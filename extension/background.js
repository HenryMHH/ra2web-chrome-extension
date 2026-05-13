// Service worker for icon management.
// Receives { cmd: 'setIcon', active: bool } from content scripts
// and calls chrome.action.setIcon() with the appropriate icon set.

const ICONS = {
  active: {
    16:  'icons/running-16.png',
    32:  'icons/running-32.png',
    48:  'icons/running-48.png',
    128: 'icons/running-128.png',
  },
  inactive: {
    16:  'icons/stopping-16.png',
    32:  'icons/stopping-32.png',
    48:  'icons/stopping-48.png',
    128: 'icons/stopping-128.png',
  },
};

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.cmd !== 'setIcon') return;
  const path = msg.active ? ICONS.active : ICONS.inactive;
  const tabId = sender.tab?.id;
  if (tabId != null) {
    chrome.action.setIcon({ tabId, path }).catch(() => {});
  } else {
    chrome.action.setIcon({ path }).catch(() => {});
  }
});
