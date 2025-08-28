import { log } from '../logger.js'
import * as pg from './pg.js'
import * as sqlite from './sqlite.js'

const dbEnv = process.env.DATABASE || ''
const usePg = dbEnv.startsWith('postgres://') || dbEnv.startsWith('postgresql://')

const impl = usePg ? pg : sqlite

export const q = impl.q
export const tx = impl.tx
export const end = impl.end
export const migrator = impl.migrator
// Expose raw sqlite db for legacy callers; undefined on pg
export const db = impl.db

log.debug({ usePg, dbEnv }, 'dbc selected')


