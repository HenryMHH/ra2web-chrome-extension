import { describe, expect, it } from 'vitest'
import { clonePrng, predictUnitCrate } from '../overlay/prng-predict'

// Minimal MT-like inner object
function makeInner(returnVal: number) {
  const proto = {
    genrand_int32(this: any): number { return returnVal },
  }
  const obj = Object.create(proto)
  obj.N = 624
  obj.M = 397
  obj.MATRIX_A = 0x9908B0DF
  obj.UPPER_MASK = 0x80000000
  obj.LOWER_MASK = 0x7FFFFFFF
  obj.mti = 10
  obj.mt = new Uint32Array(624).fill(1)
  return obj
}

// Outer wrapper that calls inner.genrand_int32 and maps to [min,max]
function makeOuter(returnVal: number) {
  const proto = {
    generateRandomInt(this: any, min: number, max: number): number {
      const n = this.prng.genrand_int32() >>> 0
      return min + (n % (max - min + 1))
    },
  }
  const obj = Object.create(proto)
  obj.prng = makeInner(returnVal)
  return obj
}

describe('clonePrng', () => {
  it('returns null when outer is null', () => {
    expect(clonePrng(null)).toBeNull()
  })

  it('returns null when outer has no .prng', () => {
    expect(clonePrng({})).toBeNull()
  })

  it('clone has independent mt copy', () => {
    const outer = makeOuter(0)
    const clone = clonePrng(outer)!
    expect(clone).not.toBeNull()
    expect(clone.prng.mt).not.toBe(outer.prng.mt)
    // Mutating clone mt does not affect original
    clone.prng.mt[0] = 9999
    expect(outer.prng.mt[0]).toBe(1)
  })

  it('clone generateRandomInt works independently', () => {
    const outer = makeOuter(5) // genrand_int32 returns 5
    const clone = clonePrng(outer)!
    // pool size 49 (0..48): 5 % 49 = 5 → generateRandomInt(0,48) = 5
    expect(clone.generateRandomInt(0, 48)).toBe(5)
    // Original prng untouched (mti unchanged)
    expect(outer.prng.mti).toBe(10)
  })
})

describe('predictUnitCrate', () => {
  it('returns null for empty pool', () => {
    const clone = makeOuter(0)
    expect(predictUnitCrate(clone, [])).toBeNull()
  })

  it('returns null when clone is null', () => {
    expect(predictUnitCrate(null, ['HTNK'])).toBeNull()
  })

  it('returns pool[index] from generateRandomInt', () => {
    const pool = ['HTNK', 'MTNK', 'LTNK']
    const clone = {
      generateRandomInt: (_min: number, _max: number) => 2,
    }
    expect(predictUnitCrate(clone, pool)).toBe('LTNK')
  })

  it('clamps out-of-range index defensively', () => {
    const pool = ['HTNK', 'MTNK']
    const clone = {
      generateRandomInt: (_min: number, _max: number) => 99,
    }
    // 99 % 2 = 1 → 'MTNK'
    expect(predictUnitCrate(clone, pool)).not.toBeNull()
  })
})
