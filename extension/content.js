// Runs in the content-script's isolated world. Bridges between the popup
// (via chrome.runtime.onMessage) and the injected page script (via
// window.postMessage).

(() => {
  const STORAGE_KEY = 'ra2NamesSettings';

  // 1. Inject the page-side script into MAIN world.
  function injectScript() {
    if (document.documentElement.dataset.ra2NamesInjected) return;
    document.documentElement.dataset.ra2NamesInjected = '1';
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('injected.js');
    s.async = false;
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }
  injectScript();

  // 2. Promise-based command -> page bridge.
  const pending = new Map();
  let seq = 0;
  function pageCmd(cmd, opts) {
    return new Promise(resolve => {
      const id = ++seq;
      pending.set(id, resolve);
      window.postMessage({ __ra2names: 'cmd', id, cmd, opts }, '*');
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ ok: false, error: 'timeout' });
        }
      }, 3000);
    });
  }

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const msg = ev.data;

    // Route response messages to pending promise resolvers.
    if (msg && msg.__ra2names === 'res') {
      const r = pending.get(msg.id);
      if (r) { pending.delete(msg.id); r(msg.result); }
      return;
    }

    // Auto-apply stored settings when injected.js is ready.
    if (msg && msg.__ra2names === 'ready') {
      try {
        const obj = await chrome.storage.local.get(STORAGE_KEY);
        const s = obj[STORAGE_KEY];
        if (!s || (!s.enabled && !s.showIndicators)) return;
        const res = await pageCmd('apply', s);
        if (res.ok) {
          chrome.runtime.sendMessage({
            cmd: 'setIcon',
            active: !!(s.enabled || s.showIndicators),
          }).catch(() => {});
        }
      } catch (_) {}
    }
  });

  // 3. Listen for popup messages.
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (!req || !req.__ra2names) return;
    (async () => {
      if (req.cmd === 'apply') {
        const res = await pageCmd('apply', req.opts);
        sendResponse(res);
      } else if (req.cmd === 'status') {
        const res = await pageCmd('status');
        sendResponse(res);
      } else if (req.cmd === 'getUnitNames') {
        const res = await pageCmd('getUnitNames');
        sendResponse(res);
      } else {
        sendResponse({ ok: false, error: 'unknown cmd' });
      }
    })();
    return true; // async sendResponse
  });
})();
