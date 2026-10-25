import process from 'node:process'

import { fileURLToPath } from 'node:url'

import { execDisclaimed } from '../index.ts'
import { report } from './report.ts'

report('caller')
execDisclaimed(
  process.execPath,
  [fileURLToPath(new URL('./exec-target.ts', import.meta.url)), 'one', 'two words'],
  { env: { DISCLAIM_FIXTURE: 'from-caller', PATH: process.env.PATH } },
)
