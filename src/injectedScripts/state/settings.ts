export interface Settings {
  enabled: boolean
  showNeutral: boolean
  showAlly: boolean
  showEnemy: boolean
  showIndicators: boolean
  enabledCrateTypes: Set<number>
  fontSize: number
  shownUnits: 'all' | Set<string>
}

export const settings: Settings = {
  enabled: false,
  showNeutral: false,
  showAlly: true,
  showEnemy: true,
  showIndicators: false,
  enabledCrateTypes: new Set<number>(),
  fontSize: 14,
  shownUnits: 'all',
}
