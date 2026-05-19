import { afterEach, describe, expect, it } from 'vitest'
import { shouldShowLabel } from '../label/policy'
import { settings } from '../state/settings'

function reset() {
  settings.enabled = false
  settings.showNeutral = false
  settings.hiddenUnits = new Set()
}

afterEach(reset)

const local = { id: 'L' }

describe('shouldShowLabel', () => {
  it('returns false when settings.enabled is false', () => {
    settings.enabled = false
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'E1' } },
    } as any)).toBe(false)
  })

  it('returns false for neutral when showNeutral is off', () => {
    settings.enabled = true
    settings.showNeutral = false
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: { isNeutral: true }, rules: { name: 'CIV' } },
    } as any)).toBe(false)
  })

  it('returns true for neutral when showNeutral is on', () => {
    settings.enabled = true
    settings.showNeutral = true
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: { isNeutral: true }, rules: { name: 'CIV' } },
    } as any)).toBe(true)
  })

  it('returns false when rule name is in hiddenUnits (case-insensitive)', () => {
    settings.enabled = true
    settings.hiddenUnits = new Set(['DOG'])
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'dog' } },
    } as any)).toBe(false)
  })

  it('returns true otherwise', () => {
    settings.enabled = true
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'E1' } },
    } as any)).toBe(true)
  })
})
