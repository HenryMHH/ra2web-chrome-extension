export type PlayerTagId = 'reliable' | 'enemy' | 'selfish' | 'newbie'

export interface PlayerTagDef {
  id: PlayerTagId
  label: string
  bg: string
}

// Order = dropdown order. Colours follow the unit-label palette (green / red) plus orange / blue.
export const PLAYER_TAGS: readonly PlayerTagDef[] = [
  { id: 'reliable', label: '可靠', bg: 'rgba(0,130,50,0.92)' },
  { id: 'enemy', label: '敵人', bg: 'rgba(160,0,0,0.92)' },
  { id: 'selfish', label: '自私', bg: 'rgba(200,110,0,0.92)' },
  { id: 'newbie', label: '新手', bg: 'rgba(0,80,170,0.92)' },
]

export function isPlayerTagId(v: unknown): v is PlayerTagId {
  return PLAYER_TAGS.some(t => t.id === v)
}

export function getPlayerTag(id: PlayerTagId): PlayerTagDef {
  return PLAYER_TAGS.find(t => t.id === id)!
}
