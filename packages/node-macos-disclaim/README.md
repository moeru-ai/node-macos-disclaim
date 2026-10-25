# `@moeru/node-macos-disclaim`

Make a macOS process its own TCC responsible process. Then permission prompts show your app, not the app that launched it.

```ts
import { ensureSelfResponsible } from '@moeru/node-macos-disclaim'

ensureSelfResponsible()
```

## Table of Contents

- [The problem](#the-problem)
- [How it works](#how-it-works)
- [When to use it](#when-to-use-it)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Limits](#limits)
- [License](#license)

## The problem

macOS TCC (Transparency, Consent, and Control) owns the microphone, camera, Accessibility, screen recording, and file privacy permissions. TCC does not charge a permission request to the process that makes it. It charges the request to the _responsible process_ of that process.

A child process inherits the responsible process of its parent. Finder, the Dock, and `open` start apps through LaunchServices, and each of those apps is its own responsible process. Other launchers start your app's binary directly with `posix_spawn`, so your app inherits theirs:

| Launcher                  | Prompt says    | Grant goes to                              |
| ------------------------- | -------------- | ------------------------------------------ |
| Finder, Dock, `open -a`   | "YourApp.app"  | Your app                                   |
| Steam                     | "Steam.app"    | Steam, and so every game that Steam starts |
| Terminal, iTerm2, VS Code | "Terminal.app" | The terminal                               |

Your app's `NSMicrophoneUsageDescription` is not used either. TCC reads the `Info.plist` of the responsible app.

## How it works

`posix_spawn` has two Apple extensions that solve this together:

- `responsibility_spawnattrs_setdisclaim()` starts the new image as its own responsible process.
- `POSIX_SPAWN_SETEXEC` replaces the current process image, as `execve(2)` does, and does not create a child.

`ensureSelfResponsible()` asks the system for the responsible process of the current process. If it is a different process, the function runs the same executable again with the same arguments, in the same process, with the disclaim flag. The PID does not change, so Steam and other launchers that wait for your process keep tracking it.

If the process is already self-responsible, the function does nothing. This is the case for a Finder launch.

LLDB, ChromeDriver (in Chromium), and Homebrew use the same private function to disclaim responsibility.

## When to use it

Use it when:

- A game platform such as Steam starts your Electron or Node.js app, and the app asks for microphone, camera, Accessibility, or screen recording access.
- A user starts your app from a terminal or an IDE, and you want the grants to belong to your app.

Do not use it when:

- You only need a child process to have its own grants. Do not re-exec the parent for that. `execDisclaimed()` in a small helper is a better fit.
- You ship through the Mac App Store. The function is a private API.
- You run on a platform other than macOS. Every function is a no-op there, so a shared code path is safe.

## Install

```sh
pnpm add @moeru/node-macos-disclaim
```

The addon is in one package for each architecture: `@moeru/node-macos-disclaim-darwin-arm64` and `@moeru/node-macos-disclaim-darwin-x64`. They are optional dependencies with `os` and `cpu` set. Package managers install only the one that matches the machine, and none on Linux or Windows.

Node-API is ABI-stable, so you do not rebuild the addon for each Node.js or Electron version.

## Usage

### Electron

Call it at the top of the main process entry, before `app.whenReady()`, before you open windows, and before `app.requestSingleInstanceLock()`:

```ts
import { ensureSelfResponsible } from '@moeru/node-macos-disclaim'
import { app } from 'electron'

ensureSelfResponsible()

app.whenReady().then(createWindow)
```

[`examples/electron`](../../examples/electron) is a complete example.

Packaging notes:

- Keep this package external in your main process bundle. It loads the addon package by name at runtime. electron-vite externalizes dependencies by default.
- If you build for another architecture than the build machine, install the optional dependency for that architecture too. For example, run `pnpm install --cpu=x64` for an x64 build on an arm64 Mac.
- A `.node` file cannot load from inside `app.asar`. electron-builder unpacks `.node` files by default. If you set `asarUnpack` yourself, include `**/*.node`.
- Sign the addon with the same Team ID as the app. With the hardened runtime, library validation rejects other signatures. electron-builder signs it with the app.

### Node.js

```ts
import { ensureSelfResponsible } from '@moeru/node-macos-disclaim'

ensureSelfResponsible()
```

It keeps `process.execArgv`, so flags such as `--inspect` stay.

### Run another executable

```ts
import { execDisclaimed } from '@moeru/node-macos-disclaim'

execDisclaimed('/Applications/YourApp.app/Contents/MacOS/YourApp', ['--from-launcher'])
```

## API

### `ensureSelfResponsible(): void`

Makes the current process its own responsible process. It re-execs the process when necessary.

It does nothing when the process is already self-responsible, when the system does not have the private functions, or on other platforms.

It sets the `DISCLAIM_REEXEC` environment variable on the new image, and removes it again in the new image. This stops a re-exec loop if a future macOS ignores the disclaim flag.

### `execDisclaimed(file, args?, options?): never`

Replaces the current process image with `file`, as its own responsible process.

| Parameter     | Description                                                 |
| ------------- | ----------------------------------------------------------- |
| `file`        | Absolute path of the executable. It is also `argv[0]`.      |
| `args`        | Arguments after `argv[0]`.                                  |
| `options.env` | Environment of the new image. The default is `process.env`. |

The new image keeps stdin, stdout, and stderr. All other file descriptors are closed. All signals get their default action, and no signal is blocked.

It throws when it fails, and the current process continues. The error has `code: 'DISCLAIM_SPAWN_FAILED'`, `errno`, and `syscall`. On other platforms, it throws.

### `getResponsiblePid(pid?): number | undefined`

Gets the PID of the responsible process of `pid`. The default is the current process. Returns `undefined` when the system cannot answer, or on other platforms.

### `isSelfResponsible(): boolean`

Tells if the current process is its own responsible process. Returns `true` when the system cannot answer, or on other platforms.

### `isSupported(): boolean`

Tells if the system has the private functions. Returns `false` on other platforms.

## Limits

- **Private API.** Apple does not document these functions and can change or remove them. The addon finds them at runtime with `dlsym()`. If they are removed, the functions do nothing and your app works as it does without this package.
- **Pending output is lost.** On macOS, Node.js writes to pipes asynchronously. Output that `console.log()` queued before the re-exec can be lost. Call `ensureSelfResponsible()` before you write output.
- **Startup runs twice.** The code before the call runs again in the new image. Keep it at the top of the entry file.
- **Non-blocking stdio stays non-blocking.** libuv sets `O_NONBLOCK` on piped stdio. The flag belongs to the shared file description, so the new image inherits it. Node.js and Electron accept this. Other programs can get `EAGAIN` from a full pipe.
- **Grants move.** After you adopt it, grants that users gave to the launcher no longer apply to your app. Users must grant access again, this time to your app.

Verified on macOS 26.3 (25D2125) with Node.js 24.15.0 and Electron 43.4.1.

## License

[MIT](../../LICENSE)
