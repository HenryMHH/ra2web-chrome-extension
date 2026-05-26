import { describe, expect, it } from 'vitest'
import { VITE_HOST_SUFFIXES, isViteHost } from '../system/loader'

describe('isViteHost', () => {
  it('matches the apex host literally', () => {
    for (const h of VITE_HOST_SUFFIXES)
      expect(isViteHost(h)).toBe(true)
  })

  it('matches a single-level subdomain', () => {
    expect(isViteHost('staging.wangerhuoda.cn')).toBe(true)
  })

  it('matches a multi-level subdomain', () => {
    expect(isViteHost('a.b.staging.wangerhuoda.cn')).toBe(true)
  })

  it('rejects unrelated hosts (ra2web / chronodivide)', () => {
    expect(isViteHost('game.chronodivide.com')).toBe(false)
    expect(isViteHost('chronodivide.com')).toBe(false)
    expect(isViteHost('game.ra2web.com')).toBe(false)
    expect(isViteHost('ra2web.com')).toBe(false)
  })

  it('rejects the suffix-confusion trick (no leading dot)', () => {
    // Would falsely match if the predicate used `endsWith(h)` instead of
    // `endsWith('.' + h)`.
    expect(isViteHost('attacker-wangerhuoda.cn')).toBe(false)
  })

  it('rejects domains where the apex is a left-substring (no trailing match)', () => {
    expect(isViteHost('wangerhuoda.cn.attacker.com')).toBe(false)
    expect(isViteHost('evil-wangerhuoda.cn.attacker.com')).toBe(false)
  })

  it('rejects empty / nonsense input', () => {
    expect(isViteHost('')).toBe(false)
    expect(isViteHost('localhost')).toBe(false)
  })
})
