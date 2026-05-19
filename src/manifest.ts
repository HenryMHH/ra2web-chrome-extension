import fs from 'fs-extra'
import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'
import { isDev, isFirefox, port, r } from '../scripts/utils'

// MV3 match patterns: '*.ra2web.com' covers subdomains but the apex 'ra2web.com' must be listed separately.
export const RA2_MATCHES = [
  'https://game.chronodivide.com/*',
  'https://chronodivide.com/*',
  'https://*.ra2web.com/*',
  'https://ra2web.com/*',
] as const

export async function getManifest() {
  const pkg = (await fs.readJSON(r('package.json'))) as typeof PkgType

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    action: {
      default_popup: 'dist/popup/index.html',
    },
    options_ui: {
      page: 'dist/options/index.html',
      open_in_tab: true,
    },
    background: isFirefox
      ? {
          scripts: ['dist/background/index.mjs'],
          type: 'module',
        }
      : {
          service_worker: 'dist/background/index.mjs',
        },

    permissions: ['tabs', 'storage', 'activeTab', 'sidePanel'],
    host_permissions: RA2_MATCHES as unknown as string[],
    content_scripts: [
      {
        matches: RA2_MATCHES as unknown as string[],
        js: ['dist/contentScripts/index.global.js'],
        run_at: 'document_idle',
        all_frames: true,
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          'dist/contentScripts/style.css',
          'dist/injectedScripts/index.global.js',
        ],
        matches: RA2_MATCHES as unknown as string[],
      },
    ],
    content_security_policy: {
      // this is required on dev for Vite script to load
      extension_pages: isDev
        ? `script-src 'self' http://localhost:${port}; object-src 'self'`
        : 'script-src \'self\'; object-src \'self\'',
    },
  }

  // add sidepanel
  if (isFirefox) {
    manifest.sidebar_action = {
      default_panel: 'dist/sidepanel/index.html',
    }
  }
  else {
    // the sidebar_action does not work for chromium based
    (manifest as any).side_panel = {
      default_path: 'dist/sidepanel/index.html',
    }
  }

  // FIXME: not work in MV3
  if (isDev && false) {
    // for content script, as browsers will cache them for each reload,
    // we use a background script to always inject the latest version
    // see src/background/contentScriptHMR.ts
    delete manifest.content_scripts
    manifest.permissions?.push('webNavigation')
  }

  return manifest
}
