import process from 'node:process'

import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const exampleDir = fileURLToPath(new URL('..', import.meta.url))
// The `electron` package exports the path of the Electron executable.
const electronPath = createRequire(import.meta.url)('electron') as string

describe.runIf(process.platform === 'darwin')('electron example', () => {
  it('runs the main process as its own responsible process', () => {
    // Build the example first with `pnpm build`.
    const output = execFileSync(electronPath, [exampleDir, '--print-status'], {
      encoding: 'utf8',
      env: { ...process.env, DISCLAIM_REEXEC: undefined, ELECTRON_RUN_AS_NODE: undefined },
      timeout: 60_000,
    })
    const status = JSON.parse(output.trim().split('\n').at(-1) ?? '{}') as { pid: number, responsible: number | null }

    // This test process is not self-responsible, so Electron starts with an inherited responsible process.
    // ensureSelfResponsible re-execs it in place.
    expect(status.responsible).toBe(status.pid)
  })
})
