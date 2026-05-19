import type * as THREE from 'three'

// r123+ has Matrix4.invert(); r122 and older only have getInverse().
// Game bundles ~r94 so getInverse is the live path; feature-detect once.
export function invertM4(out: THREE.Matrix4, src: THREE.Matrix4): void {
  if (typeof (out as any).invert === 'function') {
    (out as any).copy(src).invert()
  }
  else {
    (out as any).getInverse(src)
  }
}
