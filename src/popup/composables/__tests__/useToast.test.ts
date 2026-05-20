import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '../useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToast().clear()
  })

  it('show sets msg immediately', () => {
    const { msg, show } = useToast()
    show('ok', 'hi')
    expect(msg.value).toEqual({ kind: 'ok', text: 'hi' })
  })

  it('clears msg after default 2500ms', () => {
    const { msg, show } = useToast()
    show('ok', 'hi')
    vi.advanceTimersByTime(2499)
    expect(msg.value).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(msg.value).toBeNull()
  })

  it('clears after custom duration', () => {
    const { msg, show } = useToast()
    show('warn', 'wait', 1000)
    vi.advanceTimersByTime(999)
    expect(msg.value).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(msg.value).toBeNull()
  })

  it('second show replaces text and resets timer', () => {
    const { msg, show } = useToast()
    show('ok', 'first', 1000)
    vi.advanceTimersByTime(500)
    show('warn', 'second', 1000)
    expect(msg.value).toEqual({ kind: 'warn', text: 'second' })
    vi.advanceTimersByTime(900)
    expect(msg.value).not.toBeNull()
    vi.advanceTimersByTime(200)
    expect(msg.value).toBeNull()
  })

  it('clear() removes msg and stops timer', () => {
    const { msg, show, clear } = useToast()
    show('ok', 'gone', 1000)
    clear()
    expect(msg.value).toBeNull()
    vi.advanceTimersByTime(2000)
    expect(msg.value).toBeNull()
  })
})
