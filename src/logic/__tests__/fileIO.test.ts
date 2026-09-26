import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile, readFileText } from '../fileIO'

const origCreate = URL.createObjectURL
const origRevoke = URL.revokeObjectURL

afterEach(() => {
  vi.restoreAllMocks()
  URL.createObjectURL = origCreate
  URL.revokeObjectURL = origRevoke
  vi.useRealTimers()
})

describe('downloadTextFile', () => {
  it('clicks a temporary anchor with blob url and filename, then revokes', () => {
    const create = vi.fn(() => 'blob:fake')
    const revoke = vi.fn()
    ;(URL as any).createObjectURL = create
    ;(URL as any).revokeObjectURL = revoke
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('a.json')
      expect(this.href).toBe('blob:fake')
      expect(document.body.contains(this)).toBe(true)
    })
    vi.useFakeTimers()

    downloadTextFile('a.json', '{"x":1}')

    expect(click).toHaveBeenCalledTimes(1)
    const blob = (create.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe('application/json')
    expect(document.querySelectorAll('a[download]').length).toBe(0)
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:fake')
  })
})

describe('readFileText', () => {
  it('reads utf-8 text from a Blob', async () => {
    const f = new Blob(['{"名":"值"}'], { type: 'application/json' })
    await expect(readFileText(f)).resolves.toBe('{"名":"值"}')
  })
})
