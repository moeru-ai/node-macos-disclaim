import process from 'node:process'

import { writeSync } from 'node:fs'

import { getResponsiblePid } from '../index.ts'

// NOTICE: writeSync, not console.log. On macOS, Node.js writes to pipes asynchronously,
// so a pending console.log is lost when the process image is replaced.
export function report(stage: string, extra: Record<string, unknown> = {}): void {
  writeSync(1, `${JSON.stringify({ pid: process.pid, responsible: getResponsiblePid() ?? null, stage, ...extra })}\n`)
}
