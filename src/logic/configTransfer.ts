import type { Ra2Settings } from '~/composables/useRa2Settings'
import { normalizeSettings, normalizeShown } from '~/composables/useRa2Settings'
import type { Snapshot } from '~/composables/useRa2Snapshots'
import type { PlayerTagMap } from '~/contentScripts/playerTags/store'
import { normalizeTagMap } from '~/contentScripts/playerTags/store'
import type { PlayerTagDef } from '~/constants/playerTags'
import { normalizeCustomTags } from '~/constants/playerTags'
import { CRATE_TYPES } from '~/constants/powerups'

export const CONFIG_FILE_FORMAT = 'ra2web-assistant-config'
export const CONFIG_FILE_VERSION = 1
export const MAX_CONFIG_FILE_BYTES = 1_000_000

const FONT_MIN = 10
const FONT_MAX = 20
const NOT_CONFIG = '這不是 Ra2Web Assistant 的設定檔'

export interface ConfigData {
  settings?: Ra2Settings
  snapshots?: Snapshot[]
  playerTags?: PlayerTagMap
  customPlayerTags?: PlayerTagDef[]
}

export interface ConfigFile {
  format: typeof CONFIG_FILE_FORMAT
  version: number
  exportedAt: string
  data: ConfigData
}

// null = section absent from the file (left untouched on import).
export interface ImportSummary {
  settings: boolean
  snapshotCount: number | null
  playerTagCount: number | null
  customTagCount: number | null
}

export type ParseResult =
  | { ok: true, data: ConfigData, summary: ImportSummary }
  | { ok: false, error: string }

export function buildConfigFile(data: Required<ConfigData>, now: Date): ConfigFile {
  return {
    format: CONFIG_FILE_FORMAT,
    version: CONFIG_FILE_VERSION,
    exportedAt: now.toISOString(),
    data: {
      settings: data.settings,
      snapshots: data.snapshots,
      // Spread into a plain object so JSON.stringify output is ordinary; the
      // null-prototype invariant is restored by normalizeTagMap on import.
      playerTags: { ...data.playerTags },
      customPlayerTags: data.customPlayerTags.map(t => ({ ...t })),
    },
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function sanitizeSettings(raw: Record<string, unknown>): Ra2Settings {
  const s = normalizeSettings(raw as Parameters<typeof normalizeSettings>[0])
  const known = new Set(CRATE_TYPES.map(t => t.id))
  const crates = Array.isArray(s.enabledCrateTypes) ? s.enabledCrateTypes : []
  return {
    ...s,
    fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number.isFinite(s.fontSize) ? s.fontSize : 14))),
    enabledCrateTypes: [...new Set(crates.filter(id => typeof id === 'number' && known.has(id)))],
    selectedPresetIndex: Number.isInteger(s.selectedPresetIndex) && s.selectedPresetIndex >= -1 ? s.selectedPresetIndex : -1,
  }
}

function sanitizeSnapshots(raw: unknown[]): Snapshot[] {
  const out: Snapshot[] = []
  for (const item of raw) {
    if (!isPlainObject(item) || !('shownUnits' in item) || typeof item.name !== 'string')
      continue
    const name = item.name.trim()
    if (!name)
      continue
    const total = typeof item.totalCount === 'number' && Number.isFinite(item.totalCount) && item.totalCount >= 0
      ? item.totalCount
      : 0
    out.push({ name, shownUnits: normalizeShown(item.shownUnits), totalCount: total })
  }
  return out
}

export function parseConfigFile(text: string): ParseResult {
  if (text.length > MAX_CONFIG_FILE_BYTES)
    return { ok: false, error: '檔案過大(上限 1 MB)' }
  let root: unknown
  try {
    root = JSON.parse(text)
  }
  catch {
    return { ok: false, error: '檔案不是有效的 JSON' }
  }
  if (!isPlainObject(root) || root.format !== CONFIG_FILE_FORMAT || typeof root.version !== 'number' || !isPlainObject(root.data))
    return { ok: false, error: NOT_CONFIG }
  if (root.version > CONFIG_FILE_VERSION)
    return { ok: false, error: `設定檔版本 v${root.version} 比目前支援的 v${CONFIG_FILE_VERSION} 新,請先更新擴充功能` }

  const raw = root.data
  const data: ConfigData = {}
  const summary: ImportSummary = { settings: false, snapshotCount: null, playerTagCount: null, customTagCount: null }

  if ('settings' in raw) {
    if (!isPlainObject(raw.settings))
      return { ok: false, error: '設定檔格式錯誤:settings' }
    data.settings = sanitizeSettings(raw.settings)
    summary.settings = true
  }
  if ('snapshots' in raw) {
    if (!Array.isArray(raw.snapshots))
      return { ok: false, error: '設定檔格式錯誤:snapshots' }
    data.snapshots = sanitizeSnapshots(raw.snapshots)
    summary.snapshotCount = data.snapshots.length
  }
  if ('playerTags' in raw) {
    if (!isPlainObject(raw.playerTags))
      return { ok: false, error: '設定檔格式錯誤:playerTags' }
    data.playerTags = normalizeTagMap(raw.playerTags)
    summary.playerTagCount = Object.keys(data.playerTags).length
  }
  if ('customPlayerTags' in raw) {
    if (!Array.isArray(raw.customPlayerTags))
      return { ok: false, error: '設定檔格式錯誤:customPlayerTags' }
    data.customPlayerTags = normalizeCustomTags(raw.customPlayerTags)
    summary.customTagCount = data.customPlayerTags.length
  }
  if (!summary.settings && summary.snapshotCount === null && summary.playerTagCount === null && summary.customTagCount === null)
    return { ok: false, error: '設定檔內沒有可匯入的資料' }
  return { ok: true, data, summary }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function configFileName(now: Date): string {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `ra2web-assistant-config-${date}-${time}.json`
}

export const CONFIG_STORAGE_KEYS = {
  settings: 'ra2NamesSettings',
  snapshots: 'ra2NamesSnapshots',
  playerTags: 'ra2PlayerTags',
  customPlayerTags: 'ra2CustomPlayerTags',
} as const

export async function readConfigFromStorage(): Promise<Required<ConfigData>> {
  const keys = Object.values(CONFIG_STORAGE_KEYS)
  const obj = await browser.storage.local.get(keys)
  const rawSnaps = obj[CONFIG_STORAGE_KEYS.snapshots]
  return {
    settings: normalizeSettings(obj[CONFIG_STORAGE_KEYS.settings] as Parameters<typeof normalizeSettings>[0]),
    snapshots: Array.isArray(rawSnaps) ? sanitizeSnapshots(rawSnaps) : [],
    playerTags: normalizeTagMap(obj[CONFIG_STORAGE_KEYS.playerTags]),
    customPlayerTags: normalizeCustomTags(obj[CONFIG_STORAGE_KEYS.customPlayerTags]),
  }
}

export async function writeConfigToStorage(data: ConfigData): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.settings)
    payload[CONFIG_STORAGE_KEYS.settings] = data.settings
  if (data.snapshots)
    payload[CONFIG_STORAGE_KEYS.snapshots] = data.snapshots
  if (data.playerTags)
    payload[CONFIG_STORAGE_KEYS.playerTags] = { ...data.playerTags }
  if (data.customPlayerTags)
    payload[CONFIG_STORAGE_KEYS.customPlayerTags] = data.customPlayerTags
  if (Object.keys(payload).length === 0)
    return
  // JSON-roundtrip strips Vue reactive Proxy wrappers; chrome.storage.local.set
  // uses structured clone and throws DataCloneError on reactive arrays/objects.
  // Single set() so all present keys land together.
  await browser.storage.local.set(JSON.parse(JSON.stringify(payload)))
}
