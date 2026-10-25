import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  entry: ['src/main.ts'],
  // Keep the package external: it loads its architecture package by name at runtime.
  external: ['electron', '@moeru/node-macos-disclaim'],
  format: ['esm'],
  outDir: 'out',
  platform: 'node',
  target: 'node22',
})
