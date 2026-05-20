export function injectScript() {
  if (document.documentElement.dataset.ra2NamesInjected)
    return
  document.documentElement.dataset.ra2NamesInjected = '1'
  const s = document.createElement('script')
  s.src = browser.runtime.getURL('dist/injectedScripts/index.global.js')
  // Force UTF-8 decoding: ra2web pages may declare a non-UTF-8 charset, which
  // causes the browser to mis-decode bundled string literals (e.g. crate labels)
  // when script is loaded without an explicit charset.
  s.setAttribute('charset', 'utf-8')
  s.async = false
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s)
}
