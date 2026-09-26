import type { Ra2Settings } from '~/composables/useRa2Settings'
import { normalizeSettings, normalizeShown } from '~/composables/useRa2Settings'
import type { Snapshot } from '~/composables/useRa2Snapshots'
import type { PlayerTagMap } from '~/contentScripts/playerTags/store'
import { normalizeTagMap } from '~/contentScripts/playerTags/store'
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
  const summary: ImportSummary = { settings: false, snapshotCount: null, playerTagCount: null }

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
  if (!summary.settings && summary.snapshotCount === null && summary.playerTagCount === null)
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
