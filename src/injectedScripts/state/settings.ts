export interface Settings {
  enabled: boolean
  showNeutral: boolean
  showIndicators: boolean
  enabledCrateTypes: Set<number>
  fontSize: number
  hiddenUnits: Set<string>
}

export const settings: Settings = {
  enabled: false,
  showNeutral: false,
  showIndicators: false,
  enabledCrateTypes: new Set<number>(),
  fontSize: 14,
  hiddenUnits: new Set<string>(),
}
