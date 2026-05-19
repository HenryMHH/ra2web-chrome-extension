import { describe, expect, it } from 'vitest'
import { CRATE_TYPES, POWERUP_LABELS } from '~/constants/powerups'

describe('powerups', () => {
  it('cRATE_TYPES contains 15 entries', () => {
    expect(CRATE_TYPES).toHaveLength(15)
  })

  it('pOWERUP_LABELS and CRATE_TYPES are in sync', () => {
    for (const t of CRATE_TYPES) expect(POWERUP_LABELS[t.id]).toBe(t.label)
    expect(Object.keys(POWERUP_LABELS)).toHaveLength(CRATE_TYPES.length)
  })

  it('includes known ids 0, 11, 17', () => {
    expect(POWERUP_LABELS[0]).toBe('裝甲 ↑')
    expect(POWERUP_LABELS[11]).toBe('礦石')
    expect(POWERUP_LABELS[17]).toBe('燃燒')
  })
})
