import { FSRS, createEmptyCard } from 'ts-fsrs'
import db from './db.js'
import { log } from '../../../utils/logger.js'
import _ from 'lodash'
import { ThreeSixty } from '@mui/icons-material'

const fsrs = new FSRS()

function mix(review, fresh) {
  if ((review?.length || 0) === 0) return [...fresh]
  if ((fresh?.length || 0) === 0) return [...review]

  // Distribute new across gaps between due-ordered review, preserving review order
  const buckets = Array(review.length + 1).fill(0).map(() => [])
  for (const c of fresh) {
    const idx = Math.floor(Math.random() * buckets.length)
    buckets[idx].push(c)
  }

  const out = []
  for (let i = 0; i < review.length; i++) {
    if (buckets[i].length) out.push(...buckets[i])
    out.push(review[i])
  }
  if (buckets[review.length].length) out.push(...buckets[review.length])
  return out
}

export class StudyEngine2 {
  constructor(prefs, store) {
    this.prefs = prefs || {}
    this.store = store

    Object.assign(this, store.getState())
    // fixme: time tracking
    // history management, may be not here
  }

  _flush(keys) {
    const payload = {}
    for (const k of keys) {
      payload[k] =
        // dry the queue before _flushing
       k === 'queue' ? this[k].map(c => c?.id)
         : this[k]
    }
    this.store.setState(payload)
  }

  _getDay() {
    const now = Date.now() / (60 * 1000)
    const resetOffs = (this.prefs.dailyResetTime || 0) * 60
    const tzOffs = new Date().getTimezoneOffset()
    const delta = now - resetOffs + tzOffs
    return Math.floor(delta / (60 * 24))
  }

  async _buildQueue() {
    const now = Date.now()

    // Collect cards
    let review = await db.cards
      .where('bundleId').anyOf(this.bundleIds)
      .and(c => c.state !== 'New' && c.due <= now)
      .sortBy('due')

    let fresh = await db.cards
      .where('bundleId').anyOf(this.bundleIds)
      .and(c => c.state === 'New')
      .toArray()

    // Apply sibling bury
    if (this.prefs.autoBurySiblings) {
      review = _.uniqBy(review, 'noteId')
      fresh = _.uniqBy(fresh, 'noteId')
    }

    // Sort new cards
    const order = this.prefs.newCardOrder
    if (order === 'random') {
      fresh = _.shuffle(fresh)
    } else if (order === 'template-random') {
      fresh = _(fresh)
        .sortBy('templateOrd')
        .groupBy('templateOrd')
        .values()
        .map(_.shuffle)
        .flatten()
        .value()
    }

    // Apply caps
    fresh = fresh.slice(0, this.prefs.maxNewCards)
    review = review.slice(0, this.prefs.maxReviewCards)

    // Build queue per strategy
    const mode = this.prefs.newReviewOrder || 'mixed'
    let q = []
    if (mode === 'new-first') {
      q = [...fresh, ...review]
    } else if (mode === 'review-first') {
      q = [...review, ...fresh]
    } else {
      q = mix(review, fresh)
    }

    // Sentinel marks end-of-session when it reaches the head
    q.push(null)
    this.queue = q
    log.debug('StudyEngine2 queue built', { length: q.length })
  }

  async _bump() {
    const today = this._getDay()
    if (!this.day // first run
        || this.day !== today // new day
        || !Array.isArray(this.queue) // bad queue
    ) {
      await this._buildQueue()
      this.day = today
      this._flush(['day', 'queue'])
    }
  }

  // Cards only, exclude sentinel
  cards() {
    return (this.queue || []).filter(Boolean)
  }

  head() {
    return this.queue?.[0]
  }

  tail() {
    return this.queue?.[this.queue.length - 1]
  }

  // Stamp draw time for response_time tracking; UI may call this when showing the head
  draw() {
    // don't polute the queue
    this._drawTs = Date.now()
    return this.head()
  }

  async rate(rating) {
    const head = this.head()
    if (!head) {
      log.warn('No card to rate, shoudn\'t call')
      return
    }

    const now = new Date()
    const next = fsrs.repeat(head.fsrs?.[0] || createEmptyCard(Date.now()), now)[rating]
    head.fsrs ||= []
    const rt = this._drawTs ? now.getTime() - this._drawTs : 0
    head.fsrs.unshift({
      ...next.card,
      rating,
      response_time: rt
    })

    await db.cards.update(head.id, {
      fsrs: head.fsrs,
      due: head.fsrs[0].due,
      state: head.fsrs[0].state
    })

    // Push to tail; sentinel will drift toward head and end session
    this.queue.push(this.queue.shift())
    this._flush(['queue'])
  }

  async undo() {
    const tail = this.tail()
    if (!tail) return null

    // Revert latest FSRS entry
    if (tail.fsrs?.length) {
      tail.fsrs.shift()
      await db.cards.update(tail.id, {
        fsrs: tail.fsrs,
        due: tail.fsrs[0]?.due || Date.now(),
        state: tail.fsrs[0]?.state || 'New'
      })
    } else
      log.warn('No FSRS history to revert, shoudn\'t call')

    this.queue.unshift(this.queue.pop())
    this._flush(['queue'])
    return tail
  }
}

log.debug('StudyEngine2 module loaded')
export async function createEngine(prefs, store) {
  const eng = new StudyEngine2(prefs, store)
  // hydrate the queue
  if (Array.isArray(eng.queue))
    eng.queue = await Promise.all(eng.queue.map(async c => await db.cards.get(c.id)))

  await eng._bump()
  log.info('StudyEngine2 initialized')
  return eng
}
