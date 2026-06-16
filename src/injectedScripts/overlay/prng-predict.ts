export function clonePrng(outer: any): any | null {
  if (!outer?.prng)
    return null
  const inner = outer.prng

  const cloneInner = Object.create(Object.getPrototypeOf(inner))
  for (const k of Object.keys(inner)) {
    if (k === 'mt')
      continue
    cloneInner[k] = inner[k]
  }
  cloneInner.mt = inner.mt instanceof Uint32Array
    ? new Uint32Array(inner.mt)
    : Array.from(inner.mt)

  const cloneOuter = Object.create(Object.getPrototypeOf(outer))
  for (const k of Object.keys(outer)) {
    if (k === 'prng')
      continue
    cloneOuter[k] = outer[k]
  }
  cloneOuter.prng = cloneInner

  return cloneOuter
}

export function predictUnitCrate(clone: any, pool: string[]): string | null {
  if (!clone || pool.length === 0)
    return null
  try {
    const idx = clone.generateRandomInt(0, pool.length - 1)
    return pool[idx] ?? pool[idx % pool.length] ?? null
  }
  catch {
    return null
  }
}
