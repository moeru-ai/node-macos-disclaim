import process from 'node:process'

import { createRequire } from 'node:module'

export interface ExecDisclaimedOptions {
  /**
   * Environment of the new process image.
   *
   * @default process.env
   */
  env?: Record<string, string | undefined>
}

interface NativeBinding {
  execDisclaimed: (file: string, args: string[], env: string[] | undefined) => never
  getResponsiblePid: (pid: number) => number
  isSupported: () => boolean
}

/**
 * Name of the environment variable that `ensureSelfResponsible` sets on the new image.
 * It stops a re-exec loop if macOS ignores the disclaim flag.
 */
export const REEXEC_ENV = 'DISCLAIM_REEXEC'

let binding: NativeBinding | undefined

/**
 * Makes the current process its own TCC responsible process, with a re-exec of itself when necessary.
 *
 * Call it as early as possible: before you open files, start threads, or (in Electron) before `app.whenReady()`.
 * It does nothing when the process is already self-responsible, when the system does not support it, or on other platforms.
 */
export function ensureSelfResponsible(): void {
  if (process.platform !== 'darwin')
    return

  if (process.env[REEXEC_ENV] != null) {
    // Remove the marker so that child processes of this process can do their own check.
    delete process.env[REEXEC_ENV]
    return
  }

  if (!isSupported() || isSelfResponsible())
    return

  execDisclaimed(
    process.execPath,
    [...process.execArgv, ...process.argv.slice(1)],
    { env: { ...process.env, [REEXEC_ENV]: '1' } },
  )
}

/**
 * Replaces the current process image with `file`, as its own TCC responsible process.
 *
 * The PID does not change, so a launcher that waits for this process (for example, Steam) keeps tracking it.
 * Only stdin, stdout, and stderr stay open. All signals are reset to their default action.
 *
 * @param file - Absolute path of the executable. It is also `argv[0]`.
 * @param args - Arguments after `argv[0]`.
 * @throws When the system does not support it, or when `posix_spawn` fails. The current process then continues.
 */
export function execDisclaimed(file: string, args: readonly string[] = [], options: ExecDisclaimedOptions = {}): never {
  const native = loadBinding()
  if (native == null)
    throw new Error(`execDisclaimed is only available on macOS, not on ${process.platform}`)

  return native.execDisclaimed(file, [...args], toEnvList(options.env ?? process.env))
}

/**
 * Gets the PID of the process that TCC charges for the permission requests of `pid`.
 *
 * @param pid - Process to query. The default is the current process.
 * @returns `undefined` when the system cannot answer, or on other platforms.
 */
export function getResponsiblePid(pid: number = process.pid): number | undefined {
  const responsible = loadBinding()?.getResponsiblePid(pid) ?? -1
  return responsible > 0 ? responsible : undefined
}

/**
 * Tells if the current process is its own TCC responsible process.
 *
 * @returns `true` when the system cannot answer, or on other platforms, because then there is nothing to fix.
 */
export function isSelfResponsible(): boolean {
  const responsible = getResponsiblePid()
  return responsible == null || responsible === process.pid
}

/**
 * Tells if this system has the private macOS functions that this package needs.
 *
 * @returns `false` on every platform other than macOS.
 */
export function isSupported(): boolean {
  return loadBinding()?.isSupported() ?? false
}

function loadBinding(): NativeBinding | undefined {
  if (process.platform !== 'darwin')
    return undefined

  if (binding != null)
    return binding

  // The addon for each architecture is an optional dependency with `os` and `cpu` set,
  // so package managers install only the one that matches this machine.
  const name = `@moeru/node-macos-disclaim-darwin-${process.arch}`
  try {
    binding = createRequire(import.meta.url)(name) as NativeBinding
  }
  catch (error) {
    throw new Error(`Cannot load ${name}. Make sure that optional dependencies are installed.`, { cause: error })
  }

  return binding
}

function toEnvList(env: Record<string, string | undefined>): string[] {
  return Object.entries(env)
    .filter((entry): entry is [string, string] => entry[1] != null)
    .map(([key, value]) => `${key}=${value}`)
}
