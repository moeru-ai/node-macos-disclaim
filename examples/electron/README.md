# Electron example

This example calls `ensureSelfResponsible()` at the top of the Electron main process. It shows the PID, the responsible process, and the microphone and Accessibility status.

## Run

Start it from a terminal, so the terminal is the inherited responsible process:

```sh
pnpm build:native
pnpm build
pnpm --filter @moeru/node-macos-disclaim-example-electron start
```

The responsible process is the same as the PID. Without the package, it is the PID of the terminal.

To see the system prompt, add `--request-microphone`:

```sh
pnpm --filter @moeru/node-macos-disclaim-example-electron exec electron . --request-microphone
```

The prompt names Electron, not your terminal.

## Test

`tests/electron.test.ts` runs the built example with `--print-status`. It checks that the main process is its own responsible process.
