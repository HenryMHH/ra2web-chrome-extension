export interface CrateType {
  id: number
  label: string
}

export const CRATE_TYPES: readonly CrateType[] = [
  { id: 0, label: '裝甲 ↑' },
  { id: 1, label: '火力 ↑' },
  { id: 2, label: '基地回復' },
  { id: 3, label: '金錢' },
  { id: 4, label: '揭示地圖' },
  { id: 5, label: '速度 ↑' },
  { id: 6, label: '老兵升級' },
  { id: 7, label: '免費單位' },
  { id: 8, label: '無敵護盾' },
  { id: 11, label: '礦石' },
  { id: 13, label: '隱形' },
  { id: 14, label: '黑暗霧' },
  { id: 15, label: '爆炸' },
  { id: 16, label: '核彈' },
  { id: 17, label: '燃燒' },
] as const

export const POWERUP_LABELS: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(CRATE_TYPES.map(t => [t.id, t.label])),
)
