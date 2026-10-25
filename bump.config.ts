import { defineConfig } from 'bumpp'

export default defineConfig({
  all: true,
  commit: 'release: v%s',
  files: [
    'packages/node-macos-disclaim/package.json',
    'packages/node-macos-disclaim/npm/darwin-arm64/package.json',
    'packages/node-macos-disclaim/npm/darwin-x64/package.json',
  ],
  push: false,
  sign: false,
})
