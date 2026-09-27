import { describe, expect, it } from 'vitest'
import {
  CUSTOM_TAG_MAX,
  CUSTOM_TAG_PALETTE,
  PLAYER_TAGS,
  allPlayerTags,
  getPlayerTag,
  isBuiltinTagId,
  isValidTagId,
  normalizeCustomTags,
  tagTextColor,
  validateCustomTag,
} from '../playerTags'

const camper = { id: 'camper', label: '蹲家', bg: '#9333ea' }

describe('isBuiltinTagId / isValidTagId', () => {
  it('isBuiltinTagId accepts only the four builtin ids', () => {
    expect(isBuiltinTagId('enemy')).toBe(true)
    expect(isBuiltinTagId('camper')).toBe(false)
    expect(isBuiltinTagId(1)).toBe(false)
  })

  it('isValidTagId checks id format, not existence', () => {
    expect(isValidTagId('enemy')).toBe(true)
    expect(isValidTagId('camper')).toBe(true)
    expect(isValidTagId('a_b-9')).toBe(true)
    expect(isValidTagId('Camper')).toBe(false)
    expect(isValidTagId('-x')).toBe(false)
    expect(isValidTagId('has space')).toBe(false)
    expect(isValidTagId('x'.repeat(25))).toBe(false)
    expect(isValidTagId('')).toBe(false)
    expect(isValidTagId(3)).toBe(false)
  })
})

describe('getPlayerTag / allPlayerTags', () => {
  it('resolves builtin ids without custom list', () => {
    expect(getPlayerTag('newbie')!.label).toBe('新手')
  })

  it('resolves custom ids from the given list', () => {
    expect(getPlayerTag('camper', [camper])).toEqual(camper)
    expect(getPlayerTag('camper')).toBeUndefined()
  })

  it('allPlayerTags = builtins first, then custom in order', () => {
    expect(allPlayerTags([camper]).map(t => t.id)).toEqual(['reliable', 'enemy', 'selfish', 'newbie', 'camper'])
  })
})

describe('tagTextColor', () => {
  it('uses black text on light hex backgrounds and white on dark', () => {
    expect(tagTextColor('#ffff00')).toBe('#000')
    expect(tagTextColor('#ffffff')).toBe('#000')
    expect(tagTextColor('#1e3a8a')).toBe('#fff')
  })

  it('falls back to white for non-hex values (builtin rgba colours)', () => {
    expect(tagTextColor(PLAYER_TAGS[0].bg)).toBe('#fff')
  })
})

describe('validateCustomTag', () => {
  const ok = { id: 'camper', label: '蹲家', bg: '#9333ea' }

  it('accepts a valid new tag', () => {
    expect(validateCustomTag(ok, [])).toBeNull()
  })

  it('rejects empty / malformed / builtin / duplicate ids', () => {
    expect(validateCustomTag({ ...ok, id: '  ' }, [])).toBe('請輸入 ID')
    expect(validateCustomTag({ ...ok, id: 'Bad Id' }, [])).toBe('ID 只能使用小寫英文、數字、- 與 _(英數開頭,最多 24 字)')
    expect(validateCustomTag({ ...ok, id: 'enemy' }, [])).toBe('此 ID 為內建標籤,不可使用')
    expect(validateCustomTag(ok, [camper])).toBe('此 ID 已存在')
  })

  it('rejects empty / too long labels and bad colours', () => {
    expect(validateCustomTag({ ...ok, label: ' ' }, [])).toBe('請輸入顯示文字')
    expect(validateCustomTag({ ...ok, label: '一二三四五六七八九' }, [])).toBe('顯示文字最多 8 個字')
    expect(validateCustomTag({ ...ok, bg: 'red' }, [])).toBe('請選擇顏色')
  })

  it('enforces the custom tag limit only when adding', () => {
    const many = Array.from({ length: CUSTOM_TAG_MAX }, (_, i) => ({ id: `t${i}`, label: 'x', bg: '#000000' }))
    expect(validateCustomTag(ok, many)).toBe(`自訂標籤最多 ${CUSTOM_TAG_MAX} 個`)
    expect(validateCustomTag({ id: 't0', label: 'y', bg: '#111111' }, many, 't0')).toBeNull()
  })

  it('when editing, the id must stay the same and is not a duplicate of itself', () => {
    expect(validateCustomTag({ ...camper, label: '新名' }, [camper], 'camper')).toBeNull()
    expect(validateCustomTag({ ...camper, id: 'other' }, [camper], 'camper')).toBe('ID 不可修改')
  })
})

describe('normalizeCustomTags', () => {
  it('returns [] for non-arrays', () => {
    expect(normalizeCustomTags(undefined)).toEqual([])
    expect(normalizeCustomTags({ id: 'x' })).toEqual([])
  })

  it('drops invalid / builtin / duplicate entries, trims label, lowercases colour', () => {
    expect(normalizeCustomTags([
      { id: 'camper', label: ' 蹲家 ', bg: '#9333EA' },
      { id: 'camper', label: 'dup', bg: '#000000' },
      { id: 'enemy', label: '敵', bg: '#000000' },
      { id: 'Bad', label: 'x', bg: '#000000' },
      { id: 'nolabel', label: '  ', bg: '#000000' },
      { id: 'nocolor', label: 'x', bg: 'red' },
      'junk',
      null,
    ])).toEqual([{ id: 'camper', label: '蹲家', bg: '#9333ea' }])
  })

  it('caps the list at CUSTOM_TAG_MAX and strips extra fields', () => {
    const many = Array.from({ length: CUSTOM_TAG_MAX + 5 }, (_, i) => ({ id: `t${i}`, label: 'x', bg: '#000000', extra: 1 }))
    const out = normalizeCustomTags(many)
    expect(out).toHaveLength(CUSTOM_TAG_MAX)
    expect(Object.keys(out[0])).toEqual(['id', 'label', 'bg'])
  })
})

describe('palette', () => {
  it('contains only valid hex colours', () => {
    expect(CUSTOM_TAG_PALETTE.length).toBeGreaterThan(0)
    for (const c of CUSTOM_TAG_PALETTE)
      expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })
})
