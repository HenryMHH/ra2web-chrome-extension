// Popup logic. Reads/writes settings to chrome.storage, talks to the active
// tab's content script.

const $ = (id) => document.getElementById(id);

const els = {
  status: $('status'),
  enabled: $('enabled'),
  labelExisting: $('labelExisting'),
  rowExisting: $('row-existing'),
  chkIndicators: $('chk-indicators'),
  apply: $('apply'),
  msg: $('msg'),
};

const STORAGE_KEY = 'ra2NamesSettings';
const DEFAULTS = { enabled: false, labelExisting: false, showIndicators: false };

function setStatus(kind, text) {
  els.status.className = 'status status-' + kind;
  els.status.textContent = text;
}

function setMsg(kind, text, autoClear = true) {
  els.msg.className = 'msg ' + (kind || '');
  els.msg.textContent = text || '';
  if (autoClear && text) {
    clearTimeout(setMsg._t);
    setMsg._t = setTimeout(() => {
      els.msg.className = 'msg';
      els.msg.textContent = '';
    }, 2500);
  }
}

function updateExistingRow() {
  if (els.enabled.checked) els.rowExisting.classList.remove('disabled');
  else els.rowExisting.classList.add('disabled');
}

async function loadSettings() {
  const obj = await chrome.storage.local.get(STORAGE_KEY);
  const s = obj[STORAGE_KEY] || DEFAULTS;
  els.enabled.checked = !!s.enabled;
  els.labelExisting.checked = !!s.labelExisting;
  els.chkIndicators.checked = !!s.showIndicators;
  updateExistingRow();
}

async function saveSettings() {
  const s = {
    enabled: els.enabled.checked,
    labelExisting: els.labelExisting.checked,
    showIndicators: els.chkIndicators.checked,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: s });
  return s;
}

async function getActiveGameTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;
  const ok = /^https:\/\/(?:game\.)?chronodivide\.com\//.test(tab.url || '') ||
             /^https:\/\/(?:[^/]+\.)?ra2web\.com\//.test(tab.url || '');
  return ok ? tab : null;
}

async function probeStatus() {
  const tab = await getActiveGameTab();
  if (!tab) {
    setStatus('warn', '請在遊戲分頁開啟');
    els.apply.disabled = true;
    return null;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { __ra2names: true, cmd: 'status' });
    if (!res) throw new Error('no response');
    if (!res.systemAvailable) {
      setStatus('warn', '遊戲尚未載入完成');
      els.apply.disabled = false;
      return res;
    }
    if (res.enabled) setStatus('ok', '已啟用');
    else            setStatus('ok', '已連線');
    els.apply.disabled = false;
    return res;
  } catch (e) {
    setStatus('error', '無法連線(請重新整理遊戲頁)');
    els.apply.disabled = true;
    return null;
  }
}

async function applySettings() {
  const tab = await getActiveGameTab();
  if (!tab) { setMsg('err', '請先開啟遊戲分頁'); return; }
  const opts = await saveSettings();
  els.apply.disabled = true;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, {
      __ra2names: true, cmd: 'apply', opts,
    });
    if (!res) throw new Error('no response');
    if (!res.ok) {
      setMsg('err', '套用失敗:' + (res.error || ''));
      setStatus('error', '套用失敗');
    } else {
      setMsg('ok', opts.enabled ? '已啟用' : '已停用');
      setStatus('ok', opts.enabled ? '已啟用' : '已連線');
    }
  } catch (e) {
    setMsg('err', '無法傳送指令,請重新整理遊戲頁');
  } finally {
    els.apply.disabled = false;
  }
}

// Wire up events
els.enabled.addEventListener('change', updateExistingRow);
els.apply.addEventListener('click', applySettings);

// Boot
(async () => {
  await loadSettings();
  await probeStatus();
})();
