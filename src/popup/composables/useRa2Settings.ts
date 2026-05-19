import { CRATE_TYPES } from '~/constants/powerups'

const STORAGE_KEY = 'ra2NamesSettings'

export interface Ra2Settings {
  enabled: boolean
  showNeutral: boolean
  showIndicators: boolean
  enabledCrateTypes: number[]
  fontSize: number
  hiddenUnitsCustom: string[]
  selectedPresetIndex: number
  filterMode: 'custom' | 'preset'
}

const DEFAULTS: Ra2Settings = {
  enabled: false,
  showNeutral: false,
  showIndicators: false,
  enabledCrateTypes: [],
  fontSize: 14,
  hiddenUnitsCustom: [],
  selectedPresetIndex: -1,
  filterMode: 'custom',
}

export function useRa2Settings() {
  const settings = ref<Ra2Settings>({ ...DEFAULTS })
  const ready = ref(false)

  async function load() {
    const obj = await browser.storage.local.get(STORAGE_KEY)
    const raw = obj[STORAGE_KEY] as (Partial<Ra2Settings> & { showCrateContents?: boolean, hiddenUnits?: string[] }) | undefined
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
      settings.value = {
        enabled: !!raw.enabled,
        showNeutral: !!raw.showNeutral,
        showIndicators: !!raw.showIndicators,
        enabledCrateTypes,
        fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : 14,
        hiddenUnitsCustom: Array.isArray(raw.hiddenUnitsCustom) ? raw.hiddenUnitsCustom : (raw.hiddenUnits ?? []),
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
