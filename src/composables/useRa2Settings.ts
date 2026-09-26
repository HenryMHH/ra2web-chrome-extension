import { ref } from 'vue'
import { CRATE_TYPES } from '~/constants/powerups'

const STORAGE_KEY = 'ra2NamesSettings'

export type ShownUnits = 'all' | string[]

export interface Ra2Settings {
  enabled: boolean
  showNeutral: boolean
  showAlly: boolean
  showEnemy: boolean
  showIndicators: boolean
  enabledCrateTypes: number[]
  fontSize: number
  shownUnitsCustom: ShownUnits
  selectedPresetIndex: number
  filterMode: 'custom' | 'preset'
}

const DEFAULTS: Ra2Settings = {
  enabled: false,
  showNeutral: false,
  showAlly: true,
  showEnemy: true,
  showIndicators: false,
  enabledCrateTypes: [],
  fontSize: 14,
  shownUnitsCustom: 'all',
  selectedPresetIndex: -1,
  filterMode: 'custom',
}

interface LegacyShape {
  hiddenUnits?: string[]
  hiddenUnitsCustom?: string[]
  showCrateContents?: boolean
}

export function normalizeShown(raw: unknown): ShownUnits {
  if (raw === 'all')
    return 'all'
  if (Array.isArray(raw))
    return raw.map(s => String(s).toUpperCase())
  return 'all'
}

export function normalizeSettings(raw: (Partial<Ra2Settings> & LegacyShape) | undefined): Ra2Settings {
  if (!raw)
    return { ...DEFAULTS }
  let enabledCrateTypes = raw.enabledCrateTypes
  if (!Array.isArray(enabledCrateTypes)) {
    enabledCrateTypes = raw.showCrateContents
      ? CRATE_TYPES.map(t => t.id)
      : []
  }
  return {
    enabled: !!raw.enabled,
    showNeutral: !!raw.showNeutral,
    showAlly: raw.showAlly !== false,
    showEnemy: raw.showEnemy !== false,
    showIndicators: !!raw.showIndicators,
    enabledCrateTypes,
    fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : 14,
    shownUnitsCustom: normalizeShown(raw.shownUnitsCustom),
    selectedPresetIndex: typeof raw.selectedPresetIndex === 'number' ? raw.selectedPresetIndex : -1,
    filterMode: raw.filterMode === 'preset' ? 'preset' : 'custom',
  }
}

const settings = ref<Ra2Settings>({ ...DEFAULTS })
const ready = ref(false)
let listenerInstalled = false

function installListener() {
  if (listenerInstalled || typeof browser === 'undefined' || !browser.storage?.onChanged)
    return
  listenerInstalled = true
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY])
      return
    const next = normalizeSettings(changes[STORAGE_KEY].newValue)
    // Skip if semantically identical — prevents infinite apply loop when this
    // tab's own save() triggers onChanged and re-fires the instant watcher.
    if (JSON.stringify(next) === JSON.stringify(settings.value))
      return
    settings.value = next
  })
}

export function useRa2Settings() {
  installListener()

  async function load() {
    const obj = await browser.storage.local.get(STORAGE_KEY)
    const raw = obj[STORAGE_KEY] as (Partial<Ra2Settings> & LegacyShape) | undefined
    const legacyHidden = raw?.hiddenUnitsCustom ?? raw?.hiddenUnits
    if (raw && raw.shownUnitsCustom === undefined && Array.isArray(legacyHidden) && legacyHidden.length > 0) {
      // eslint-disable-next-line no-console
      console.info(
        '[ra2-names] Migrated settings to whitelist schema; old hide list dropped, defaulting to "show all".',
      )
    }
    settings.value = normalizeSettings(raw)
    ready.value = true
  }

  async function save() {
    // JSON-roundtrip strips Vue reactive Proxy wrappers; chrome.storage.local.set
    // uses structured clone and throws DataCloneError on reactive arrays/objects.
    await browser.storage.local.set({ [STORAGE_KEY]: JSON.parse(JSON.stringify(settings.value)) })
  }

  return { settings, ready, load, save }
}
