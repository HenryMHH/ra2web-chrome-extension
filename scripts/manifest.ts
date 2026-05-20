import fs from 'fs-extra'
import { getManifest } from '../src/manifest'
import { log, r } from './utils'

const ICON_SIZES = [16, 32, 48, 128] as const

export async function writeManifest() {
  await fs.writeJSON(r('extension/manifest.json'), await getManifest(), { spaces: 2 })
  await fs.ensureDir(r('extension/assets'))
  for (const size of ICON_SIZES) {
    await fs.copy(
      r(`src/assets/icon-${size}.png`),
      r(`extension/assets/icon-${size}.png`),
    )
  }
  log('PRE', 'write manifest.json + copy icons')
}

writeManifest()
