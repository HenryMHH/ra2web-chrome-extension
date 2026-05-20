import { afterEach, describe, expect, it } from 'vitest'
import { shouldShowLabel } from '../label/policy'
import { settings } from '../state/settings'

function reset() {
  settings.enabled = false
  settings.showNeutral = false
  settings.shownUnits = 'all'
}

afterEach(reset)

const local = { id: 'L' }

describe('shouldShowLabel', () => {
  it('returns false when settings.enabled is false', () => {
    settings.enabled = false
    settings.shownUnits = 'all'
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'E1' } },
    } as any)).toBe(false)
  })

  it('returns false for neutral when showNeutral is off', () => {
    settings.enabled = true
    settings.showNeutral = false
    settings.shownUnits = 'all'
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: { isNeutral: true }, rules: { name: 'CIV' } },
    } as any)).toBe(false)
  })

  it('returns true for neutral when showNeutral is on', () => {
    settings.enabled = true
    settings.showNeutral = true
    settings.shownUnits = 'all'
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: { isNeutral: true }, rules: { name: 'CIV' } },
    } as any)).toBe(true)
  })

  it('returns true when shownUnits is the "all" sentinel', () => {
    settings.enabled = true
    settings.shownUnits = 'all'
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'E1' } },
    } as any)).toBe(true)
  })

  it('returns true when rule name is in shownUnits Set (case-insensitive)', () => {
    settings.enabled = true
    settings.shownUnits = new Set(['DOG'])
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'dog' } },
    } as any)).toBe(true)
  })

  it('returns false when rule name is NOT in shownUnits Set', () => {
    settings.enabled = true
    settings.shownUnits = new Set(['DOG'])
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'E1' } },
    } as any)).toBe(false)
  })

  it('returns false when shownUnits Set is empty (whitelist excludes everything)', () => {
    settings.enabled = true
    settings.shownUnits = new Set()
    expect(shouldShowLabel({
      viewer: { value: local },
      gameObject: { owner: local, rules: { name: 'E1' } },
    } as any)).toBe(false)
  })
})
