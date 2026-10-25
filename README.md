# node-macos-disclaim

[![npm version][npmx-version-src]][npmx-version-href]
[![npm downloads][npmx-downloads-src]][npmx-downloads-href]
[![License][license-src]][license-href]

Make a macOS process its own TCC responsible process. Then permission prompts show your app, not the app that launched it.

When Steam, a terminal, or an IDE starts your app, macOS charges the microphone, camera, Accessibility, and screen recording requests of your app to that launcher. The prompt says "Steam.app", and the grant goes to Steam.

```ts
import { ensureSelfResponsible } from '@moeru/node-macos-disclaim'

// At the top of the Electron main process or the Node.js entry.
ensureSelfResponsible()
```

The function re-execs the process in place with the private `responsibility_spawnattrs_setdisclaim()` flag. The PID does not change, so the launcher keeps tracking the process.

## Packages

| Package                                                        | Use it for                                        |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [`@moeru/node-macos-disclaim`](./packages/node-macos-disclaim) | The API for Node.js and the Electron main process |
| `@moeru/node-macos-disclaim-darwin-arm64`                      | The Node-API addon for Apple silicon              |
| `@moeru/node-macos-disclaim-darwin-x64`                        | The Node-API addon for Intel Macs                 |

The main package installs only the architecture package that matches the machine. Read the [package README](./packages/node-macos-disclaim/README.md) for the API, the packaging notes, and the limits.

[`examples/electron`](./examples/electron) is a complete Electron example.

## Requirements

- macOS 11 or later at runtime. On other platforms, every function is a no-op.
- Node.js 20 or later, or Electron.
- Xcode command line tools (clang) when you build the native addon.

## Development

```sh
pnpm install
pnpm build:native
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

`pnpm build:native` builds the addon for the host architecture. `TARGET_ARCH=arm64` and `TARGET_ARCH=x86_64` select an architecture. clang can build both on one Mac.

`pnpm test` also starts the built Electron example. Run `pnpm build:native` and `pnpm build` before it.

To release, run `pnpm bumpp` and push the tag. The release workflow builds each addon on a macOS runner of its architecture, then publishes the three packages with npm trusted publishing.

## License

[MIT](./LICENSE)

[npmx-version-src]: https://npmx.dev/api/registry/badge/version/@moeru/node-macos-disclaim
[npmx-version-href]: https://npmx.dev/@moeru/node-macos-disclaim
[npmx-downloads-src]: https://npmx.dev/api/registry/badge/downloads-month/@moeru/node-macos-disclaim
[npmx-downloads-href]: https://npmx.dev/@moeru/node-macos-disclaim
[license-src]: https://npmx.dev/api/registry/badge/license/@moeru/node-macos-disclaim
[license-href]: https://github.com/moeru-ai/node-macos-disclaim/blob/main/LICENSE
