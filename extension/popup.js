// Popup logic. Reads/writes settings to chrome.storage, talks to the active
// tab's content script.

const $ = (id) => document.getElementById(id);

const els = {
  status: $('status'),
  enabled: $('enabled'),
  chkNeutral: $('chk-neutral'),
  selFontSize: $('sel-fontsize'),
  chkIndicators: $('chk-indicators'),
  apply: $('apply'),
  msg: $('msg'),
};

const STORAGE_KEY = 'ra2NamesSettings';
const DEFAULTS = { enabled: false, showNeutral: false, showIndicators: false, fontSize: 14, hiddenUnits: [] };

let allUnits  = [];   // [[ruleName, displayName], ...]
let hiddenUnits = new Set();

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

function syncLabelRows() {
  const on = els.enabled.checked;
  document.getElementById('row-neutral').classList.toggle('disabled', !on);
  document.getElementById('row-fontsize').classList.toggle('disabled', !on);
}

async function loadSettings() {
  const obj = await chrome.storage.local.get(STORAGE_KEY);
  const s = obj[STORAGE_KEY] || DEFAULTS;
  els.enabled.checked       = !!s.enabled;
  els.chkNeutral.checked    = !!s.showNeutral;
  els.selFontSize.value     = String(s.fontSize ?? 14);
  els.chkIndicators.checked = !!s.showIndicators;
  hiddenUnits = new Set(s.hiddenUnits || []);
  updateFilterBadge();
}

async function saveSettings() {
  const s = {
    enabled:        els.enabled.checked,
    showNeutral:    els.chkNeutral.checked,
    showIndicators: els.chkIndicators.checked,
    fontSize:       Number(els.selFontSize.value),
    hiddenUnits:    [...hiddenUnits],
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
    if (res.enabled || res.showIndicators) setStatus('ok', '已啟用');
    else                                    setStatus('ok', '已連線');
    els.apply.disabled = false;
    return res;
  } catch (e) {
    setStatus('error', '無法連線(請重新整理遊戲頁)');
    els.apply.disabled = true;
    return null;
  }
}

function updateFilterBadge() {
  const badge = document.getElementById('filter-badge');
  if (!badge) return;
  badge.textContent = hiddenUnits.size > 0 ? `${hiddenUnits.size} 已隱藏` : '';
}

function renderFilterList(searchText = '') {
  const container = document.getElementById('filter-list');
  const countLabel = document.getElementById('filter-count-label');
  if (!container) return;
  const q = searchText.trim().toLowerCase();
  const filtered = allUnits.filter(([ruleName, displayName]) =>
    !q || displayName.toLowerCase().includes(q) || ruleName.toLowerCase().includes(q)
  );
  container.innerHTML = '';
  filtered.forEach(([ruleName, displayName]) => {
    const label = document.createElement('label');
    label.className = 'filter-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !hiddenUnits.has(ruleName);
    cb.dataset.rule = ruleName;
    cb.addEventListener('change', () => {
      if (cb.checked) hiddenUnits.delete(ruleName);
      else hiddenUnits.add(ruleName);
      updateFilterBadge();
    });
    const nameSpan = document.createElement('span');
    nameSpan.className = 'filter-item-name';
    nameSpan.textContent = displayName;
    const ruleSpan = document.createElement('span');
    ruleSpan.className = 'filter-item-rule';
    ruleSpan.textContent = ruleName;
    label.append(cb, nameSpan, ruleSpan);
    container.appendChild(label);
  });
  if (countLabel) countLabel.textContent = `${filtered.length} / ${allUnits.length}`;
}

async function loadAndRenderUnitList() {
  const note = document.getElementById('filter-note');
  const search = document.getElementById('filter-search');
  const toolbar = document.querySelector('.filter-toolbar');
  if (allUnits.length > 0) {
    if (note)    note.style.display = 'none';
    if (search)  search.style.display = '';
    if (toolbar) toolbar.style.display = '';
    renderFilterList(search?.value || '');
    return;
  }
  if (note) note.textContent = '載入中…';
  const tab = await getActiveGameTab();
  if (!tab) {
    if (note) note.textContent = '請先連線至遊戲';
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { __ra2names: true, cmd: 'getUnitNames' });
    if (!res || !res.units || res.units.length === 0) {
      if (note) note.textContent = res?.source === 'none'
        ? '進入對局後單位清單才會出現'
        : '無法取得單位清單';
      return;
    }
    allUnits = res.units;
    if (note)    note.style.display = 'none';
    if (search)  search.style.display = '';
    if (toolbar) toolbar.style.display = '';
    renderFilterList(search?.value || '');
  } catch (e) {
    if (note) note.textContent = '無法連線，請重新整理遊戲頁';
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
els.apply.addEventListener('click', applySettings);
els.enabled.addEventListener('change', syncLabelRows);

document.getElementById('section-filter')?.addEventListener('toggle', (e) => {
  if (e.target.open) loadAndRenderUnitList();
});

document.getElementById('filter-search')?.addEventListener('input', (e) => {
  renderFilterList(e.target.value);
});

document.getElementById('filter-all')?.addEventListener('click', () => {
  hiddenUnits.clear();
  updateFilterBadge();
  renderFilterList(document.getElementById('filter-search')?.value || '');
});

document.getElementById('filter-none')?.addEventListener('click', () => {
  const q = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
  const toHide = q
    ? allUnits.filter(([ruleName, displayName]) =>
        displayName.toLowerCase().includes(q) || ruleName.toLowerCase().includes(q))
    : allUnits;
  toHide.forEach(([ruleName]) => hiddenUnits.add(ruleName));
  updateFilterBadge();
  renderFilterList(document.getElementById('filter-search')?.value || '');
});

// Boot
(async () => {
  await loadSettings();
  syncLabelRows();
  await probeStatus();
})();
