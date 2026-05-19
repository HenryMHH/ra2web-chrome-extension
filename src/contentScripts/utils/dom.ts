export function injectScript() {
  if (document.documentElement.dataset.ra2NamesInjected)
    return
  document.documentElement.dataset.ra2NamesInjected = '1'
  const s = document.createElement('script')
  s.src = browser.runtime.getURL('dist/injectedScripts/index.global.js')
  s.async = false
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s)
}
