import { beforeEach, describe, expect, it } from 'vitest'
import { shouldShowLabel } from '../label/policy'
import { settings } from '../state/settings'
import type { PipOverlayLike } from '../types'

function pip(team: 'self' | 'ally' | 'enemy' | 'neutral', ruleName = 'E1'): PipOverlayLike {
  const local = { id: 'me' }
  let owner: any
  if (team === 'self')
    owner = local
  else if (team === 'neutral')
    owner = { isNeutral: true }
  else
    owner = { id: 'other' }
  return {
    viewer: { value: local },
    gameObject: { owner, rules: { name: ruleName } },
    alliances: { areAllied: () => team === 'ally' },
  } as any
}

describe('shouldShowLabel — faction filters', () => {
  beforeEach(() => {
    settings.enabled = true
    settings.showAlly = true
    settings.showEnemy = true
    settings.showNeutral = true
    settings.shownUnits = 'all'
  })

  it('hides ally when showAlly=false', () => {
    settings.showAlly = false
    expect(shouldShowLabel(pip('ally'))).toBe(false)
  })

  it('still shows self even when showAlly=false', () => {
    settings.showAlly = false
    expect(shouldShowLabel(pip('self'))).toBe(true)
  })

  it('hides enemy when showEnemy=false', () => {
    settings.showEnemy = false
    expect(shouldShowLabel(pip('enemy'))).toBe(false)
  })

  it('hides neutral when showNeutral=false', () => {
    settings.showNeutral = false
    expect(shouldShowLabel(pip('neutral'))).toBe(false)
  })

  it('shows everything when all faction toggles on', () => {
    expect(shouldShowLabel(pip('ally'))).toBe(true)
    expect(shouldShowLabel(pip('enemy'))).toBe(true)
    expect(shouldShowLabel(pip('neutral'))).toBe(true)
    expect(shouldShowLabel(pip('self'))).toBe(true)
  })
})
