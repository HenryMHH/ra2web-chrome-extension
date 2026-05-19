import { runtime } from '../state/runtime'
import { tracking } from '../state/tracking'

export type UnitRow = [ruleName: string, displayName: string, objectType?: string]

export function enumerateRulesUnits(): UnitRow[] | null {
  const rules = runtime.gameRef?.rules
  if (!rules)
    return null
  const maps: Array<[string, any]> = [
    ['infantry', rules.infantryRules],
    ['vehicle', rules.vehicleRules],
    ['aircraft', rules.aircraftRules],
    ['building', rules.buildingRules],
  ]
  const rows: UnitRow[] = []
  for (const [objectType, m] of maps) {
    if (!m || typeof m.forEach !== 'function')
      continue
    m.forEach((rule: any, ruleName: string) => {
      if (!ruleName)
        return
      let displayName = ruleName
      const key = rule?.uiName
      if (key && runtime.strings) {
        try {
          const v = runtime.strings.get(key)
          if (v)
            displayName = v
        }
        catch {}
      }
      rows.push([String(ruleName).toUpperCase(), displayName, objectType])
    })
  }
  if (rows.length === 0)
    return null
  rows.sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'))
  return rows
}

export interface UnitNamesResult {
  units: UnitRow[]
  source: 'rules' | 'discovered' | 'strings' | 'none'
}

export function getUnitNames(): UnitNamesResult {
  const fromRules = enumerateRulesUnits()
  if (fromRules)
    return { units: fromRules, source: 'rules' }
  if (tracking.discoveredUnits.size > 0) {
    const units: UnitRow[] = [...tracking.discoveredUnits.entries()]
      .map(([k, v]) => [String(k).toUpperCase(), v] as UnitRow)
      .sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'))
    return { units, source: 'discovered' }
  }
  if (runtime.strings?.data) {
    const units: UnitRow[] = Object.entries(runtime.strings.data)
      .filter(([k]) => k.startsWith('name:'))
      .map(([k, v]) => [k.slice(5).toUpperCase(), v as string] as UnitRow)
      .sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'))
    return { units, source: 'strings' }
  }
  return { units: [], source: 'none' }
}
