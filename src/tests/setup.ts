// Polyfills for jsdom test environment

// reka-ui components (Slider, etc.) rely on ResizeObserver which jsdom lacks.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error - assigning polyfill onto globalThis
  globalThis.ResizeObserver = ResizeObserverPolyfill
}
