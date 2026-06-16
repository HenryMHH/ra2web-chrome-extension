import { afterEach, describe, expect, it } from 'vitest'
import { enumerateRulesUnits, getCratePoolOrdered, getUnitNames } from '../rules/enumerate'
import { runtime } from '../state/runtime'
import { tracking } from '../state/tracking'

afterEach(() => {
  runtime.gameRef = null
  runtime.strings = null
  tracking.discoveredUnits.clear()
})

describe('enumerateRulesUnits', () => {
  it('returns null when gameRef missing', () => {
    runtime.gameRef = null
    expect(enumerateRulesUnits()).toBeNull()
  })

  it('aggregates infantry vehicle aircraft building maps', () => {
    const mk = (entries: [string, any][]) => new Map(entries)
    runtime.gameRef = {
      rules: {
        infantryRules: mk([['E1', { uiName: 'name:E1' }]]),
        vehicleRules: mk([['MTNK', { uiName: 'name:MTNK' }]]),
        aircraftRules: mk([['HARV', { uiName: 'name:HARV' }]]),
        buildingRules: mk([['GAPILE', { uiName: 'name:GAPILE' }]]),
      },
    }
    runtime.strings = {
      get: (k: string) => ({
        'name:E1': '大兵',
        'name:MTNK': '犀牛',
        'name:HARV': '礦車',
        'name:GAPILE': '兵營',
      } as Record<string, string>)[k] || '',
    } as any
    const rows = enumerateRulesUnits()!
    expect(rows).toHaveLength(4)
    const names = rows.map(r => r[1]).sort()
    expect(names).toEqual(['兵營', '大兵', '犀牛', '礦車'].sort())
  })
})

describe('getUnitNames', () => {
  it('uses rules source first', () => {
    runtime.gameRef = {
      rules: { infantryRules: new Map([['E1', { uiName: 'name:E1' }]]) },
    }
    runtime.strings = { get: () => '大兵' } as any
    const r = getUnitNames()
    expect(r.source).toBe('rules')
    expect(r.units).toHaveLength(1)
  })

  it('falls back to discovered when rules unavailable', () => {
    runtime.gameRef = null
    tracking.discoveredUnits.set('E1', '大兵')
    const r = getUnitNames()
    expect(r.source).toBe('discovered')
  })

  it('falls back to strings.data as last resort', () => {
    runtime.gameRef = null
    tracking.discoveredUnits.clear()
    runtime.strings = { data: { 'name:E1': '大兵', 'other:foo': 'x' } } as any
    const r = getUnitNames()
    expect(r.source).toBe('strings')
    expect(r.units).toEqual([['E1', '大兵']])
  })
})

describe('getCratePoolOrdered', () => {
  it('returns empty array when gameRef missing', () => {
    runtime.gameRef = null
    expect(getCratePoolOrdered()).toEqual([])
  })

  it('returns ruleNames of crateGoodie vehicles in insertion order', () => {
    runtime.gameRef = {
      rules: {
        vehicleRules: new Map([
          ['MTNK', { crateGoodie: false }],
          ['HTNK', { crateGoodie: true }],
          ['LTNK', { crateGoodie: true }],
          ['TNKD', { crateGoodie: true }],
        ]),
      },
    }
    runtime.strings = null
    expect(getCratePoolOrdered()).toEqual(['HTNK', 'LTNK', 'TNKD'])
  })

  it('excludes vehicles with crateGoodie falsy', () => {
    runtime.gameRef = {
      rules: {
        vehicleRules: new Map([
          ['MTNK', { crateGoodie: false }],
          ['HTNK', { crateGoodie: undefined }],
        ]),
      },
    }
    expect(getCratePoolOrdered()).toEqual([])
  })

  it('uppercases ruleName', () => {
    runtime.gameRef = {
      rules: {
        vehicleRules: new Map([
          ['mtnk', { crateGoodie: true }],
        ]),
      },
    }
    expect(getCratePoolOrdered()).toEqual(['MTNK'])
  })
})
