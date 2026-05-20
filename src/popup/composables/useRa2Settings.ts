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

function normalizeShown(raw: unknown): ShownUnits {
  if (raw === 'all')
    return 'all'
  if (Array.isArray(raw))
    return raw.map(s => String(s).toUpperCase())
  return 'all'
}

export function useRa2Settings() {
  const settings = ref<Ra2Settings>({ ...DEFAULTS })
  const ready = ref(false)

  async function load() {
    const obj = await browser.storage.local.get(STORAGE_KEY)
    const raw = obj[STORAGE_KEY] as (Partial<Ra2Settings> & LegacyShape) | undefined
    if (!raw) {
      settings.value = { ...DEFAULTS }
    }
    else {
      let enabledCrateTypes = raw.enabledCrateTypes
      if (!Array.isArray(enabledCrateTypes)) {
        enabledCrateTypes = raw.showCrateContents
          ? CRATE_TYPES.map(t => t.id)
          : []
      }
      const legacyHidden = raw.hiddenUnitsCustom ?? raw.hiddenUnits
      if (raw.shownUnitsCustom === undefined && Array.isArray(legacyHidden) && legacyHidden.length > 0) {
        // eslint-disable-next-line no-console
        console.info(
          '[ra2-names] Migrated settings to whitelist schema; old hide list dropped, defaulting to "show all".',
        )
      }
      settings.value = {
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
    ready.value = true
  }

  async function save() {
    await browser.storage.local.set({ [STORAGE_KEY]: { ...settings.value } })
  }

  return { settings, ready, load, save }
}
