import { defineConfig } from 'vite'
import { sharedConfig } from './vite.config.mjs'
import { isDev, r } from './scripts/utils'
import packageJson from './package.json'

// Bundles the early sniff content script (Vite-host loader PoC).
// Output is loaded as a static content_script at document_start in the MAIN world.
export default defineConfig({
  ...sharedConfig,
  define: {
    '__DEV__': isDev,
    '__NAME__': JSON.stringify(packageJson.name),
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  build: {
    watch: isDev ? {} : undefined,
    outDir: r('extension/dist/earlySniff'),
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    lib: {
      entry: r('src/earlySniff/index.ts'),
      name: `${packageJson.name}_early`,
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.global.js',
        extend: true,
      },
    },
  },
})
