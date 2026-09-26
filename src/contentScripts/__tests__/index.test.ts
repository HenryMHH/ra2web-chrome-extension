import { beforeEach, describe, expect, it, vi } from 'vitest'

// This file never references bare `browser` (unplugin-auto-import would hoist a static
// webextension-polyfill import above these mocks). But `../index` itself uses bare `browser`
// (inside its onPageReady callback), so unplugin-auto-import injects a real
// `import browser from 'webextension-polyfill'` at the top of that compiled module — the
// polyfill throws immediately unless a chrome-extension-shaped global is present. Same
// pattern as store.test.ts / controller.test.ts: stub `chrome` (and `browser`, the polyfill's
// own wrapped export) before dynamically importing '../index'.
const storageApi = {
  local: {
    get: (_key: string) => Promise.resolve({}),
    set: (_obj: Record<string, any>) => Promise.resolve(),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(),
  },
}
;(globalThis as any).chrome = {
  runtime: { id: 'test', sendMessage: vi.fn().mockResolvedValue(undefined) },
  storage: storageApi,
}
;(globalThis as any).browser = {
  runtime: { id: 'test', sendMessage: vi.fn().mockResolvedValue(undefined) },
  storage: storageApi,
}

const onMessageMock = vi.fn()
const onPageReadyMock = vi.fn()
const injectScriptMock = vi.fn()
const startPlayerTagsMock = vi.fn()

vi.mock('webext-bridge/content-script', () => ({ onMessage: onMessageMock }))
vi.mock('../utils/dom', () => ({ injectScript: injectScriptMock }))
vi.mock('../utils/pageBridge', () => ({ onPageReady: onPageReadyMock, pageCmd: vi.fn() }))
vi.mock('../playerTags', () => ({ startPlayerTags: startPlayerTagsMock }))

beforeEach(() => {
  vi.resetModules()
  onMessageMock.mockReset()
  onPageReadyMock.mockReset()
  injectScriptMock.mockReset()
  startPlayerTagsMock.mockReset()
})

describe('content script bootstrap', () => {
  it('registers the webext-bridge handlers and onPageReady even when startPlayerTags() throws synchronously', async () => {
    startPlayerTagsMock.mockImplementation(() => {
      throw new Error('observer.observe: body is null')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(import('../index')).resolves.toBeDefined()

    expect(onPageReadyMock).toHaveBeenCalledTimes(1)
    expect(onMessageMock).toHaveBeenCalledTimes(3)
    expect(onMessageMock).toHaveBeenCalledWith('ra2:apply', expect.any(Function))
    expect(onMessageMock).toHaveBeenCalledWith('ra2:status', expect.any(Function))
    expect(onMessageMock).toHaveBeenCalledWith('ra2:getUnitNames', expect.any(Function))
    expect(warn).toHaveBeenCalledWith('[ra2-names] player tags failed to start:', expect.any(Error))

    warn.mockRestore()
  })

  it('starts player tags only after the bridge handlers are wired up', async () => {
    const order: string[] = []
    onPageReadyMock.mockImplementation(() => order.push('onPageReady'))
    onMessageMock.mockImplementation(() => order.push('onMessage'))
    startPlayerTagsMock.mockImplementation(() => order.push('startPlayerTags'))

    await import('../index')

    expect(order).toEqual(['onPageReady', 'onMessage', 'onMessage', 'onMessage', 'startPlayerTags'])
  })
})
