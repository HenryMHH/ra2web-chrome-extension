/* eslint-disable no-console */
import { injectScript } from './utils/dom';

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
(() => {
  console.info('[vitesse-webext] Hello world from content script!!!!!')

  injectScript()
})()
