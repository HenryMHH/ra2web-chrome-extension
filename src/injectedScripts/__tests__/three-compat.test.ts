import { describe, expect, it, vi } from 'vitest'
import { invertM4 } from '../system/three-compat'

describe('invertM4', () => {
  it('calls .copy(src).invert() when invert exists', () => {
    const invert = vi.fn().mockReturnThis()
    const copy = vi.fn().mockReturnValue({ invert })
    const out = { copy, invert: () => out }
    const src = { _id: 'src' }

    invertM4(out as any, src as any)

    expect(copy).toHaveBeenCalledWith(src)
    expect(invert).toHaveBeenCalled()
  })

  it('falls back to getInverse when invert missing', () => {
    const getInverse = vi.fn()
    const out: any = { getInverse }
    const src = { _id: 'src' }

    invertM4(out, src as any)

    expect(getInverse).toHaveBeenCalledWith(src)
  })
})
