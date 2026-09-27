export type BuiltinPlayerTagId = 'reliable' | 'enemy' | 'selfish' | 'newbie'

// Any tag id stored in a tag map: a builtin id or a user-defined custom id (CUSTOM_TAG_ID_RE).
// Whether a def for it currently exists is resolved at render time via getPlayerTag.
export type PlayerTagId = string

export interface PlayerTagDef {
  id: PlayerTagId
  label: string
  bg: string
}

export interface CustomTagDraft {
  id: string
  label: string
  bg: string
}

// Order = dropdown order. Colours follow the unit-label palette (green / red) plus orange / blue.
// Builtins are fixed: never editable or removable from the UI.
export const PLAYER_TAGS: readonly PlayerTagDef[] = [
  { id: 'reliable', label: '可靠', bg: 'rgba(0,130,50,0.92)' },
  { id: 'enemy', label: '敵人', bg: 'rgba(160,0,0,0.92)' },
  { id: 'selfish', label: '自私', bg: 'rgba(200,110,0,0.92)' },
  { id: 'newbie', label: '新手', bg: 'rgba(0,80,170,0.92)' },
]

// Builtin ids also satisfy this pattern, so it doubles as the tag-map value check.
export const CUSTOM_TAG_ID_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/
export const CUSTOM_TAG_LABEL_MAX = 8
export const CUSTOM_TAG_MAX = 20
const COLOR_RE = /^#[0-9a-f]{6}$/i

export const CUSTOM_TAG_PALETTE: readonly string[] = [
  '#16a34a',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#2563eb',
  '#0891b2',
  '#9333ea',
  '#db2777',
  '#4b5563',
]

export function isBuiltinTagId(v: unknown): v is BuiltinPlayerTagId {
  return PLAYER_TAGS.some(t => t.id === v)
}

export function isValidTagId(v: unknown): v is PlayerTagId {
  return typeof v === 'string' && CUSTOM_TAG_ID_RE.test(v)
}

export function getPlayerTag(id: PlayerTagId, custom: readonly PlayerTagDef[] = []): PlayerTagDef | undefined {
  return PLAYER_TAGS.find(t => t.id === id) ?? custom.find(t => t.id === id)
}

export function allPlayerTags(custom: readonly PlayerTagDef[]): PlayerTagDef[] {
  return [...PLAYER_TAGS, ...custom]
}

// Count code points, not UTF-16 units, so a CJK / emoji label is measured as the user sees it.
function labelLength(s: string): number {
  return [...s].length
}

// Custom colours are arbitrary, so white text is unreadable on light picks. Non-hex values
// (the builtin rgba palette) are all dark → white.
export function tagTextColor(bg: string): '#fff' | '#000' {
  if (!COLOR_RE.test(bg))
    return '#fff'
  const n = Number.parseInt(bg.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#000' : '#fff'
}

// Returns a zh-Hant error message, or null when the draft is acceptable.
// editingId set = updating that existing tag (id must stay the same, no limit/dup check).
export function validateCustomTag(
  draft: CustomTagDraft,
  existing: readonly PlayerTagDef[],
  editingId?: string,
): string | null {
  const id = draft.id.trim()
  const label = draft.label.trim()
  if (!id)
    return '請輸入 ID'
  if (!CUSTOM_TAG_ID_RE.test(id))
    return 'ID 只能使用小寫英文、數字、- 與 _(英數開頭,最多 24 字)'
  if (isBuiltinTagId(id))
    return '此 ID 為內建標籤,不可使用'
  if (editingId === undefined) {
    if (existing.some(t => t.id === id))
      return '此 ID 已存在'
    if (existing.length >= CUSTOM_TAG_MAX)
      return `自訂標籤最多 ${CUSTOM_TAG_MAX} 個`
  }
  else if (id !== editingId) {
    return 'ID 不可修改'
  }
  if (!label)
    return '請輸入顯示文字'
  if (labelLength(label) > CUSTOM_TAG_LABEL_MAX)
    return `顯示文字最多 ${CUSTOM_TAG_LABEL_MAX} 個字`
  if (!COLOR_RE.test(draft.bg))
    return '請選擇顏色'
  return null
}

// Storage / import sanitizer: drops (never repairs) bad entries, so a corrupt list degrades to
// "fewer custom tags" instead of failing. Builds fresh plain objects (no extra fields, no Proxy).
export function normalizeCustomTags(raw: unknown): PlayerTagDef[] {
  if (!Array.isArray(raw))
    return []
  const out: PlayerTagDef[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (out.length >= CUSTOM_TAG_MAX)
      break
    if (!item || typeof item !== 'object' || Array.isArray(item))
      continue
    const { id, label, bg } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof label !== 'string' || typeof bg !== 'string')
      continue
    const cleanLabel = label.trim()
    if (!CUSTOM_TAG_ID_RE.test(id) || isBuiltinTagId(id) || seen.has(id))
      continue
    if (!cleanLabel || labelLength(cleanLabel) > CUSTOM_TAG_LABEL_MAX || !COLOR_RE.test(bg))
      continue
    seen.add(id)
    out.push({ id, label: cleanLabel, bg: bg.toLowerCase() })
  }
  return out
}
