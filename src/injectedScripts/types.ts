import type * as THREE from 'three'

export type Team = 'enemy' | 'self' | 'ally' | 'neutral' | 'unknown'

export type ShownUnits = 'all' | string[]

export interface ApplyOpts {
  enabled?: boolean
  showNeutral?: boolean
  showAlly?: boolean
  showEnemy?: boolean
  showIndicators?: boolean
  enabledCrateTypes?: number[]
  fontSize?: number
  shownUnits?: ShownUnits
}

export interface ApplyResult {
  ok: boolean
  error?: string
  state?: {
    enabled: boolean
    showNeutral: boolean
    showAlly: boolean
    showEnemy: boolean
    showIndicators: boolean
    enabledCrateTypes: number[]
    fontSize: number
  }
}

export interface GameOwner {
  isNeutral?: boolean
  getOwnedObjects: () => GameObjectLike[]
}

export interface GameObjectLike {
  isDestroyed?: boolean
  position?: { worldPosition: { x: number, y: number, z: number } }
  rules?: { name?: string, uiName?: string }
}

export interface PipOverlayLike {
  gameObject?: {
    rules?: { name?: string, uiName?: string }
    owner?: GameOwner
    crateBonuses?: { firepower: number, armor: number, speed: number }
  }
  rootObj?: THREE.Object3D & { matrixWorldNeedsUpdate: boolean }
  camera?: THREE.Camera
  alliances?: {
    areAllied: (a: unknown, b: unknown) => boolean
    playerList?: { players?: GameOwner[] }
  }
  viewer?: { value: unknown }
  strings?: { get: (key: string) => string, data?: Record<string, string> }
  __unameLblTracked?: boolean
}

export interface LabelCache {
  mesh: THREE.Mesh
  dispose: () => void
  text: string
  owner: unknown
  team: Team
  fontSize: number
}
