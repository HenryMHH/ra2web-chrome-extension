import { describe, expect, it } from 'vitest'
import { CRATE_TYPES, POWERUP_LABELS } from '~/constants/powerups'

describe('powerups', () => {
  it('exposes 15 crate type entries', () => {
    expect(CRATE_TYPES).toHaveLength(15)
  })

  it('keeps POWERUP_LABELS in sync with CRATE_TYPES', () => {
    for (const t of CRATE_TYPES) expect(POWERUP_LABELS[t.id]).toBe(t.label)
    expect(Object.keys(POWERUP_LABELS)).toHaveLength(CRATE_TYPES.length)
  })

  it('includes known ids 0, 11, 17', () => {
    expect(POWERUP_LABELS[0]).toBe('裝甲 ↑')
    expect(POWERUP_LABELS[11]).toBe('礦石')
    expect(POWERUP_LABELS[17]).toBe('燃燒')
  })
})
