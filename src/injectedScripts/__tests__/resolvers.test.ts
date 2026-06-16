import { afterEach, describe, expect, it } from 'vitest'
import { resolveName, resolveNameFromGo, resolveTeam } from '../pip/resolvers'
import { runtime } from '../state/runtime'

function makePip(o: any) {
  return o
}

describe('resolveTeam', () => {
  const local = { id: 'local' }

  it('returns unknown when viewer or owner missing', () => {
    expect(resolveTeam(makePip({}))).toBe('unknown')
  })

  it('returns neutral when owner.isNeutral', () => {
    const pip = makePip({ viewer: { value: local }, gameObject: { owner: { isNeutral: true } } })
    expect(resolveTeam(pip)).toBe('neutral')
  })

  it('returns self when owner === local', () => {
    const pip = makePip({ viewer: { value: local }, gameObject: { owner: local } })
    expect(resolveTeam(pip)).toBe('self')
  })

  it('returns ally when alliances.areAllied true', () => {
    const owner = { id: 'ally' }
    const pip = makePip({
      viewer: { value: local },
      gameObject: { owner },
      alliances: { areAllied: (a: unknown, b: unknown) => a === owner && b === local },
    })
    expect(resolveTeam(pip)).toBe('ally')
  })

  it('returns enemy otherwise', () => {
    const pip = makePip({
      viewer: { value: local },
      gameObject: { owner: { id: 'foe' } },
      alliances: { areAllied: () => false },
    })
    expect(resolveTeam(pip)).toBe('enemy')
  })
})

describe('resolveName', () => {
  it('uses strings.get(uiName) when available', () => {
    const pip = makePip({
      gameObject: { rules: { uiName: 'name:E1', name: 'E1' } },
      strings: { get: (k: string) => k === 'name:E1' ? '美國大兵' : '' },
    })
    expect(resolveName(pip)).toBe('美國大兵')
  })

  it('falls back to rules.name if strings empty', () => {
    const pip = makePip({
      gameObject: { rules: { uiName: 'name:X', name: 'X' } },
      strings: { get: () => '' },
    })
    expect(resolveName(pip)).toBe('X')
  })

  it('returns null if no rules', () => {
    expect(resolveName(makePip({}))).toBeNull()
  })

  it('appends (P) when only firepower bonus active', () => {
    const pip = makePip({
      gameObject: {
        rules: { uiName: 'name:APOC', name: 'APOC' },
        crateBonuses: { firepower: 1.5, armor: 1, speed: 1 },
      },
      strings: { get: (k: string) => k === 'name:APOC' ? '天啟坦克' : '' },
    })
    expect(resolveName(pip)).toBe('天啟坦克(P)')
  })

  it('appends (D) when only armor bonus active', () => {
    const pip = makePip({
      gameObject: {
        rules: { uiName: 'name:APOC', name: 'APOC' },
        crateBonuses: { firepower: 1, armor: 1.5, speed: 1 },
      },
      strings: { get: (k: string) => k === 'name:APOC' ? '天啟坦克' : '' },
    })
    expect(resolveName(pip)).toBe('天啟坦克(D)')
  })

  it('appends (S) when only speed bonus active', () => {
    const pip = makePip({
      gameObject: {
        rules: { uiName: 'name:APOC', name: 'APOC' },
        crateBonuses: { firepower: 1, armor: 1, speed: 1.5 },
      },
      strings: { get: (k: string) => k === 'name:APOC' ? '天啟坦克' : '' },
    })
    expect(resolveName(pip)).toBe('天啟坦克(S)')
  })

  it('appends (P/D/S) when all three bonuses active', () => {
    const pip = makePip({
      gameObject: {
        rules: { uiName: 'name:APOC', name: 'APOC' },
        crateBonuses: { firepower: 1.5, armor: 1.5, speed: 1.5 },
      },
      strings: { get: (k: string) => k === 'name:APOC' ? '天啟坦克' : '' },
    })
    expect(resolveName(pip)).toBe('天啟坦克(P/D/S)')
  })

  it('appends (P/S) when firepower and speed active but not armor', () => {
    const pip = makePip({
      gameObject: {
        rules: { uiName: 'name:APOC', name: 'APOC' },
        crateBonuses: { firepower: 1.5, armor: 1, speed: 1.5 },
      },
      strings: { get: (k: string) => k === 'name:APOC' ? '天啟坦克' : '' },
    })
    expect(resolveName(pip)).toBe('天啟坦克(P/S)')
  })

  it('returns plain name when crateBonuses absent (e.g. Building)', () => {
    const pip = makePip({
      gameObject: {
        rules: { uiName: 'name:GAWEAP', name: 'GAWEAP' },
        // no crateBonuses
      },
      strings: { get: (k: string) => k === 'name:GAWEAP' ? '戰神基地' : '' },
    })
    expect(resolveName(pip)).toBe('戰神基地')
  })

  it('returns plain name when all bonuses are exactly 1 (default)', () => {
    const pip = makePip({
      gameObject: {
        rules: { uiName: 'name:APOC', name: 'APOC' },
        crateBonuses: { firepower: 1, armor: 1, speed: 1 },
      },
      strings: { get: (k: string) => k === 'name:APOC' ? '天啟坦克' : '' },
    })
    expect(resolveName(pip)).toBe('天啟坦克')
  })
})

describe('resolveNameFromGo', () => {
  afterEach(() => {
    runtime.strings = null
  })
  it('uses runtime.strings', () => {
    runtime.strings = { get: (k: string) => k === 'name:E1' ? '大兵' : '' } as any
    const go = { rules: { uiName: 'name:E1', name: 'E1' } }
    expect(resolveNameFromGo(go as any)).toBe('大兵')
  })
})
