import { log } from '../logger.js'
import * as pg from './pg.js'
import * as sqlite from './sqlite.js'

const usePg = process.env.USE_POSTGRES === 'true'

const impl = usePg ? pg : sqlite

export const q = impl.q
export const tx = impl.tx
export const end = impl.end
export const migrator = impl.migrator
// Expose raw sqlite db for legacy callers; undefined on pg
export const db = impl.db

log.debug({ usePg }, 'dbc selected')


