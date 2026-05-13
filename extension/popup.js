// Popup logic. Reads/writes settings to chrome.storage, talks to the active
// tab's content script.

const $ = (id) => document.getElementById(id);

const els = {
  status: $('status'),
  enabled: $('enabled'),
  chkNeutral: $('chk-neutral'),
  selFontSize: $('sel-fontsize'),
  chkIndicators: $('chk-indicators'),
  chkCrates: $('chk-crates'),
  apply: $('apply'),
  msg: $('msg'),
};

const STORAGE_KEY = 'ra2NamesSettings';
const DEFAULTS = { enabled: false, showNeutral: false, showIndicators: false, showCrateContents: false, fontSize: 14, hiddenUnits: [], filterMode: 'custom' };

let allUnits  = [];   // [[ruleName, displayName], ...]
let hiddenUnits = new Set();
const SNAPSHOTS_KEY = 'ra2NamesSnapshots';
let filterMode = 'custom';   // 'custom' | 'preset'
let snapshots  = [];         // [{ name, hiddenUnits, totalCount }, ...]

async function updateActionIcon(tabId, active) {
  const path = active ? {
    16:  'icons/running-16.png',
    32:  'icons/running-32.png',
    48:  'icons/running-48.png',
    128: 'icons/running-128.png',
  } : {
    16:  'icons/stopping-16.png',
    32:  'icons/stopping-32.png',
    48:  'icons/stopping-48.png',
    128: 'icons/stopping-128.png',
  };
  try { await chrome.action.setIcon({ tabId, path }); } catch (_) {}
}

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
  els.chkCrates.checked     = !!s.showCrateContents;
  hiddenUnits = new Set(s.hiddenUnits || []);
  filterMode  = s.filterMode || 'custom';
  updateFilterBadge();
}

async function saveSettings() {
  const s = {
    enabled:        els.enabled.checked,
    showNeutral:    els.chkNeutral.checked,
    showIndicators: els.chkIndicators.checked,
    showCrateContents: els.chkCrates.checked,
    fontSize:       Number(els.selFontSize.value),
    hiddenUnits:    [...hiddenUnits],
    filterMode,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: s });
  return s;
}

async function loadSnapshots() {
  const obj = await chrome.storage.local.get(SNAPSHOTS_KEY);
  snapshots = obj[SNAPSHOTS_KEY] || [];
}

async function saveSnapshots() {
  await chrome.storage.local.set({ [SNAPSHOTS_KEY]: snapshots });
}

async function saveSnapshot(name) {
  const ts = new Date().toISOString();
  snapshots.push({
    name: `${name} ${ts}`,
    hiddenUnits: [...hiddenUnits],
    totalCount: allUnits.length,
  });
  await saveSnapshots();
}

async function deleteSnapshot(index) {
  snapshots.splice(index, 1);
  await saveSnapshots();
}

function renderSnapshotSelect() {
  const note = document.getElementById('filter-preset-note');
  const row  = document.getElementById('filter-preset-row');
  const sel  = document.getElementById('filter-preset-select');
  if (!sel) return;
  sel.innerHTML = '';
  if (snapshots.length === 0) {
    if (note) note.style.display = '';
    if (row)  row.style.display  = 'none';
    return;
  }
  if (note) note.style.display = 'none';
  if (row)  row.style.display  = '';
  snapshots.forEach((snap, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    const shown = Math.max(0, snap.totalCount - snap.hiddenUnits.length);
    opt.textContent = `${snap.name} (${shown}/${snap.totalCount})`;
    sel.appendChild(opt);
  });
}

function switchMode(mode) {
  filterMode = mode;
  const customEl      = document.getElementById('filter-mode-custom');
  const presetEl      = document.getElementById('filter-mode-preset');
  const modeCustomBtn = document.getElementById('mode-custom');
  const modePresetBtn = document.getElementById('mode-preset');
  const isCustom = mode === 'custom';
  if (customEl)      customEl.style.display      = isCustom ? '' : 'none';
  if (presetEl)      presetEl.style.display      = isCustom ? 'none' : '';
  if (modeCustomBtn) modeCustomBtn.classList.toggle('active', isCustom);
  if (modePresetBtn) modePresetBtn.classList.toggle('active', !isCustom);
  if (!isCustom) renderSnapshotSelect();
  const saveRow = document.getElementById('filter-save-row');
  if (saveRow) saveRow.style.display = (isCustom && allUnits.length > 0) ? '' : 'none';
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
      await updateActionIcon(tab.id, false);
      els.apply.disabled = false;
      return res;
    }
    const active = !!(res.enabled || res.showIndicators || res.showCrateContents);
    setStatus('ok', active ? '已啟用' : '已連線');
    await updateActionIcon(tab.id, active);
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
    const saveRow = document.getElementById('filter-save-row');
    if (saveRow) saveRow.style.display = '';
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
    const saveRow = document.getElementById('filter-save-row');
    if (saveRow) saveRow.style.display = '';
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
      await updateActionIcon(tab.id, !!(opts.enabled || opts.showIndicators || opts.showCrateContents));
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
  if (e.target.open) {
    switchMode(filterMode);
    if (filterMode === 'custom') loadAndRenderUnitList();
  }
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

document.getElementById('mode-custom')?.addEventListener('click', () => {
  switchMode('custom');
  loadAndRenderUnitList();
});

document.getElementById('mode-preset')?.addEventListener('click', () => {
  switchMode('preset');
});

document.getElementById('filter-save-btn')?.addEventListener('click', async () => {
  const nameInput = document.getElementById('filter-save-name');
  const name = (nameInput?.value || '').trim();
  if (!name) { setMsg('warn', '請輸入快照名稱'); return; }
  if (allUnits.length === 0) { setMsg('warn', '請先載入單位清單'); return; }
  await saveSnapshot(name);
  if (nameInput) nameInput.value = '';
  setMsg('ok', `快照「${name}」已儲存`);
});

document.getElementById('filter-preset-select')?.addEventListener('change', async (e) => {
  const raw = e.target.value;
  if (raw === '') return;
  const index = Number(raw);
  const snap = snapshots[index];
  if (!snap) return;
  hiddenUnits = new Set(snap.hiddenUnits);
  updateFilterBadge();
  await applySettings();
});

document.getElementById('filter-preset-delete')?.addEventListener('click', async () => {
  const sel = document.getElementById('filter-preset-select');
  if (!sel || snapshots.length === 0) return;
  const raw = sel.value;
  if (raw === '' || isNaN(Number(raw))) return;
  const index = Number(raw);
  if (index < 0 || index >= snapshots.length) return;
  await deleteSnapshot(index);
  renderSnapshotSelect();
});

// Boot
(async () => {
  await loadSettings();
  await loadSnapshots();
  syncLabelRows();
  await probeStatus();
})();
