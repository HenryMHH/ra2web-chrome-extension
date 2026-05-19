import type * as THREE from 'three'

export interface Runtime {
  PipOverlay: any | null
  CanvasUtils: any | null
  SpriteUtils: any | null
  Coords: any | null
  crateTraitRef: any | null
  gameRef: any | null
  activeCamera: THREE.Camera | null
  alliances: any | null
  viewer: any | null
  strings: any | null
}

export const runtime: Runtime = {
  PipOverlay: null,
  CanvasUtils: null,
  SpriteUtils: null,
  Coords: null,
  crateTraitRef: null,
  gameRef: null,
  activeCamera: null,
  alliances: null,
  viewer: null,
  strings: null,
}
