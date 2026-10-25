import process from 'node:process'

import { ensureSelfResponsible, REEXEC_ENV } from '../index.ts'
import { report } from './report.ts'

report('before', { args: process.argv.slice(2), marker: process.env[REEXEC_ENV] ?? null })
ensureSelfResponsible()
report('after', { marker: process.env[REEXEC_ENV] ?? null })
