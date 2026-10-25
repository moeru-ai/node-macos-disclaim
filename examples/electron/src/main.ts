import process from 'node:process'

import { writeSync } from 'node:fs'

import { ensureSelfResponsible, getResponsiblePid } from '@moeru/node-macos-disclaim'
import { app, BrowserWindow, systemPreferences } from 'electron'

// Run this before anything else. Code above this line runs twice when the process re-execs.
ensureSelfResponsible()

interface Status {
  accessibility: boolean
  microphone: string
  pid: number
  responsible: number | null
}

function readStatus(): Status {
  return {
    accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    pid: process.pid,
    responsible: getResponsiblePid() ?? null,
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => `&#${character.charCodeAt(0)};`)
}

function renderStatus(status: Status): string {
  const rows = Object.entries(status)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`)
    .join('')

  return `<!doctype html><meta charset="utf-8"><title>disclaim example</title>
<style>body{font:14px system-ui;margin:24px}th{text-align:left;padding-right:16px}</style>
<h1>TCC responsible process</h1><table>${rows}</table>
<p>Start this app from a terminal. Without the package, the responsible process is the terminal.</p>`
}

app.whenReady().then(async () => {
  // Used by tests/electron.test.ts: print the status as one JSON line, then quit.
  if (process.argv.includes('--print-status')) {
    writeSync(1, `${JSON.stringify(readStatus())}\n`)
    app.quit()
    return
  }

  // Shows the system prompt. It names this app when the process is self-responsible.
  if (process.argv.includes('--request-microphone'))
    await systemPreferences.askForMediaAccess('microphone')

  const window = new BrowserWindow({ height: 320, width: 520 })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderStatus(readStatus()))}`)
})

app.on('window-all-closed', () => app.quit())
