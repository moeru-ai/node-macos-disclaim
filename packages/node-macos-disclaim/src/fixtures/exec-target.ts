import process from 'node:process'

import { report } from './report.ts'

report('target', { args: process.argv.slice(2), fixtureEnv: process.env.DISCLAIM_FIXTURE ?? null, home: process.env.HOME ?? null })
