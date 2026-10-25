import process from 'node:process'

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ensureSelfResponsible, execDisclaimed, getResponsiblePid, isSelfResponsible, isSupported } from './index'

const isDarwin = process.platform === 'darwin'

type Report = Record<string, unknown>

/**
 * Runs a fixture and parses one JSON report from each output line.
 * Fails the test when the fixture does not print exactly `count` lines.
 */
function runFixture(name: string, count: number, args: string[] = []): Report[] {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), ...args], {
    encoding: 'utf8',
    // Remove inherited markers so that the fixture starts like a fresh launch.
    env: { ...process.env, DISCLAIM_REEXEC: undefined },
  })

  const reports = output.trim().split('\n').map(line => JSON.parse(line) as Report)
  expect(reports).toHaveLength(count)

  return reports
}

function reportAt(reports: Report[], index: number): Report {
  const report = reports[index]
  if (report == null)
    throw new Error(`Missing report ${index}`)

  return report
}

describe.runIf(isDarwin)('on macOS', () => {
  it('finds the private responsibility functions', () => {
    expect(isSupported()).toBe(true)
  })

  it('reports that a spawned process belongs to its launcher', () => {
    // Vitest is started from a terminal or a CI agent, so this worker inherits that responsible process.
    expect(getResponsiblePid()).toBeTypeOf('number')
    expect(getResponsiblePid()).not.toBe(process.pid)
    expect(isSelfResponsible()).toBe(false)
  })

  it('makes the process self-responsible with the same pid', () => {
    const reports = runFixture('ensure.ts', 3, ['--flag', 'two words'])
    const before = reportAt(reports, 0)

    expect(before).toMatchObject({ args: ['--flag', 'two words'], marker: null, stage: 'before' })
    expect(before.responsible).not.toBe(before.pid)

    // The same script runs again in the new image: same pid, own responsible process, marker set.
    expect(reportAt(reports, 1)).toMatchObject({ args: ['--flag', 'two words'], marker: '1', pid: before.pid, responsible: before.pid, stage: 'before' })

    // The marker is removed, so child processes can do their own check.
    expect(reportAt(reports, 2)).toMatchObject({ marker: null, pid: before.pid, responsible: before.pid, stage: 'after' })
  })

  it('replaces the image with another executable, its arguments, and its environment', () => {
    const reports = runFixture('exec-caller.ts', 2)
    const caller = reportAt(reports, 0)

    expect(caller.responsible).not.toBe(caller.pid)
    expect(reportAt(reports, 1)).toEqual({
      args: ['one', 'two words'],
      fixtureEnv: 'from-caller',
      home: null,
      pid: caller.pid,
      responsible: caller.pid,
      stage: 'target',
    })
  })

  it('throws and keeps the process running when the executable does not exist', () => {
    expect(() => execDisclaimed('/nonexistent/disclaim-test', [])).toThrowError(expect.objectContaining({
      code: 'DISCLAIM_SPAWN_FAILED',
      errno: 2,
      syscall: 'posix_spawn',
    }))
  })

  it('reports no responsible process for a pid that does not exist', () => {
    expect(getResponsiblePid(2 ** 31 - 1)).toBeUndefined()
  })
})

describe.skipIf(isDarwin)('on other platforms', () => {
  it('does nothing', () => {
    expect(isSupported()).toBe(false)
    expect(getResponsiblePid()).toBeUndefined()
    expect(isSelfResponsible()).toBe(true)
    expect(() => ensureSelfResponsible()).not.toThrow()
    expect(() => execDisclaimed('/bin/true')).toThrowError(/only available on macOS/)
  })
})
