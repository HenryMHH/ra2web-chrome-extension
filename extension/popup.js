// Popup logic. Reads/writes settings to chrome.storage, talks to the active
// tab's content script.

const $ = (id) => document.getElementById(id);

const CRATE_TYPES = [
  { id: 0,  label: '裝甲 ↑' },
  { id: 1,  label: '火力 ↑' },
  { id: 2,  label: '基地回復' },
  { id: 3,  label: '金錢' },
  { id: 4,  label: '揭示地圖' },
  { id: 5,  label: '速度 ↑' },
  { id: 6,  label: '老兵升級' },
  { id: 7,  label: '免費單位' },
  { id: 8,  label: '無敵護盾' },
  { id: 11, label: '礦石' },
  { id: 13, label: '隱形' },
  { id: 14, label: '黑暗霧' },
  { id: 15, label: '爆炸' },
  { id: 16, label: '核彈' },
  { id: 17, label: '燃燒' },
];

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
const DEFAULTS = { enabled: false, showNeutral: false, showIndicators: false, enabledCrateTypes: [], fontSize: 14, hiddenUnits: [], filterMode: 'custom' };

let allUnits  = [];   // [[ruleName, displayName], ...]
let hiddenUnitsCustom = new Set();
let selectedPresetIndex = -1;
let enabledCrateTypes = new Set();
const SNAPSHOTS_KEY = 'ra2NamesSnapshots';
let filterMode = 'custom';   // 'custom' | 'preset'
let snapshots  = [];         // [{ name, hiddenUnits, totalCount }, ...]

function getEffectiveHiddenUnits() {
  if (filterMode === 'preset' && selectedPresetIndex >= 0 && snapshots[selectedPresetIndex]) {
    return snapshots[selectedPresetIndex].hiddenUnits;
  }
  return [...hiddenUnitsCustom];
}

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
  // Migrate old showCrateContents boolean → enabledCrateTypes array
  if (Array.isArray(s.enabledCrateTypes)) {
    enabledCrateTypes = new Set(s.enabledCrateTypes.map(Number));
  } else if (s.showCrateContents) {
    enabledCrateTypes = new Set(CRATE_TYPES.map(t => t.id));
  } else {
    enabledCrateTypes = new Set();
  }
  // Load custom hidden units (migrate from old key 'hiddenUnits')
  hiddenUnitsCustom = new Set(s.hiddenUnitsCustom || s.hiddenUnits || []);
  selectedPresetIndex = typeof s.selectedPresetIndex === 'number' ? s.selectedPresetIndex : -1;
  filterMode  = s.filterMode || 'custom';
  renderCrateGrid();
  updateFilterBadge();
}

async function saveSettings() {
  const s = {
    enabled:            els.enabled.checked,
    showNeutral:        els.chkNeutral.checked,
    showIndicators:     els.chkIndicators.checked,
    enabledCrateTypes:  [...enabledCrateTypes],
    fontSize:           Number(els.selFontSize.value),
    hiddenUnitsCustom:  [...hiddenUnitsCustom],
    selectedPresetIndex,
    filterMode,
    hiddenUnits:        getEffectiveHiddenUnits(),
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
    hiddenUnits: [...hiddenUnitsCustom],
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
  // Normalize: keep state in sync with what dropdown visually shows.
  // Browser auto-displays first option, so default invalid index to 0.
  if (selectedPresetIndex < 0 || selectedPresetIndex >= snapshots.length) {
    selectedPresetIndex = 0;
  }
  sel.value = String(selectedPresetIndex);
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
    const active = !!(res.enabled || res.showIndicators || (res.enabledCrateTypes?.length > 0));
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

function updateCrateBadge() {
  const badge = document.getElementById('crate-badge');
  if (!badge) return;
  const n = enabledCrateTypes.size;
  if (n === 0) {
    badge.textContent = '已關閉';
    badge.className = 'filter-badge badge-off';
  } else if (CRATE_TYPES.every(({ id }) => enabledCrateTypes.has(id))) {
    badge.textContent = '全部';
    badge.className = 'filter-badge';
  } else {
    badge.textContent = `${n}/${CRATE_TYPES.length}`;
    badge.className = 'filter-badge';
  }
}

function renderCrateGrid() {
  const grid = document.getElementById('crate-type-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const { id, label } of CRATE_TYPES) {
    const btn = document.createElement('button');
    btn.className = 'crate-type-btn' + (enabledCrateTypes.has(id) ? ' active' : '');
    btn.textContent = label;
    btn.dataset.crateId = String(id);
    btn.addEventListener('click', () => {
      if (enabledCrateTypes.has(id)) enabledCrateTypes.delete(id);
      else enabledCrateTypes.add(id);
      btn.classList.toggle('active', enabledCrateTypes.has(id));
      updateCrateBadge();
    });
    grid.appendChild(btn);
  }
  updateCrateBadge();
}

function updateFilterBadge() {
  const badge = document.getElementById('filter-badge');
  if (!badge) return;
  badge.textContent = hiddenUnitsCustom.size > 0 ? `${hiddenUnitsCustom.size} 已隱藏` : '';
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
    cb.checked = !hiddenUnitsCustom.has(ruleName);
    cb.dataset.rule = ruleName;
    cb.addEventListener('change', () => {
      if (cb.checked) hiddenUnitsCustom.delete(ruleName);
      else hiddenUnitsCustom.add(ruleName);
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

function updateActiveFilterInfo() {
  const el = document.getElementById('active-filter-info');
  if (!el) return;
  if (filterMode === 'preset' && selectedPresetIndex >= 0 && snapshots[selectedPresetIndex]) {
    const snap = snapshots[selectedPresetIndex];
    const shown = Math.max(0, snap.totalCount - snap.hiddenUnits.length);
    el.textContent = `套用中：客製選項 — ${snap.name} (${shown}/${snap.totalCount})`;
    el.className = 'active-filter-info preset';
  } else if (filterMode === 'custom') {
    const hidden = hiddenUnitsCustom.size;
    el.textContent = hidden > 0
      ? `套用中：單場自訂 — ${hidden} 已隱藏`
      : `套用中：單場自訂 — 全部顯示`;
    el.className = hidden > 0 ? 'active-filter-info custom has-hidden' : 'active-filter-info custom';
  } else {
    el.textContent = '客製選項：未選取';
    el.className = 'active-filter-info';
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
      await updateActionIcon(tab.id, !!(opts.enabled || opts.showIndicators || opts.enabledCrateTypes.length > 0));
      updateActiveFilterInfo();
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
  hiddenUnitsCustom.clear();
  updateFilterBadge();
  renderFilterList(document.getElementById('filter-search')?.value || '');
});

document.getElementById('filter-none')?.addEventListener('click', () => {
  const q = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
  const toHide = q
    ? allUnits.filter(([ruleName, displayName]) =>
        displayName.toLowerCase().includes(q) || ruleName.toLowerCase().includes(q))
    : allUnits;
  toHide.forEach(([ruleName]) => hiddenUnitsCustom.add(ruleName));
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

document.getElementById('filter-preset-select')?.addEventListener('change', (e) => {
  const raw = e.target.value;
  if (raw === '') return;
  const index = Number(raw);
  if (!snapshots[index]) return;
  selectedPresetIndex = index;
  // Apply deferred to the Apply button — no auto-commit on selection change.
});

document.getElementById('filter-preset-delete')?.addEventListener('click', async () => {
  const sel = document.getElementById('filter-preset-select');
  if (!sel || snapshots.length === 0) return;
  const raw = sel.value;
  if (raw === '' || isNaN(Number(raw))) return;
  const index = Number(raw);
  if (index < 0 || index >= snapshots.length) return;
  await deleteSnapshot(index);
  if (selectedPresetIndex >= index) {
    selectedPresetIndex = snapshots.length > 0 ? 0 : -1;
  }
  if (snapshots.length === 0) filterMode = 'custom';
  renderSnapshotSelect();
  updateActiveFilterInfo();
});

document.getElementById('crate-all')?.addEventListener('click', () => {
  CRATE_TYPES.forEach(({ id }) => enabledCrateTypes.add(id));
  renderCrateGrid();
});

document.getElementById('crate-none')?.addEventListener('click', () => {
  enabledCrateTypes.clear();
  renderCrateGrid();
});

// Boot
(async () => {
  await loadSettings();
  await loadSnapshots();
  updateActiveFilterInfo();
  syncLabelRows();
  await probeStatus();
})();
