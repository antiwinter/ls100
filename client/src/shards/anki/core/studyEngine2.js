import _ from 'lodash'
import { FSRS, createEmptyCard } from 'ts-fsrs'
import db from './db.js'
import { log } from '../../../utils/logger.js'
import { TimeTracker } from '../../../utils/timeTracker.js'

const fsrs = new FSRS()

function mix(dst, src) {
  if (!dst?.length || !src?.length) return

  // N random positions
  const pos = _.shuffle(_.range(0, dst.length + 1))
    .slice(0, src.length)     // Take first N positions (N = src.length)
    .sort((a, b) => a - b)    // Sort ascending for sequential insertion

  src.forEach((x, i) => {
    dst.splice(pos[i] + i, 0, x)  // +i adjusts for previous insertions
  })
}

export class StudyEngine2 {
  constructor(prefs, store) {
    this.prefs = prefs || {}
    this.store = store

    Object.assign(this, store.getState())

    // time tracking (auto-open, auto-idle)
    this._trackTime = this._trackTime.bind(this)
    this._tt = new TimeTracker({
      ttd: this.ttd,
      onSlice: this._trackTime
    })

    // history management, may be not here
  }

  _trackTime(_slice, ttd) {
    this.ttd = ttd
    this._flush(['ttd'])
  }

  _flush(keys) {
    const payload = {}
    for (const k of keys) {
      payload[k] =
        // dry the queue before _flushing
       k === 'queue' ? this[k].map(c => c?.id ?? null)
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
    let q = [...review]
    if (mode === 'new-first') {
      q = [...fresh, ...q]
    } else if (mode === 'review-first') {
      q.push(...fresh)
    } else
      mix(q, fresh)

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
      // reset time tracking for new day
      this._tt?.destroy()
      this._tt = new TimeTracker({ onSlice: this._trackTime })
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
    // don't pollute the queue
    this._drawTs = Date.now()
    return this.head()
  }

  async rate(rating) {
    const head = this.head()
    if (!head) {
      log.warn('No card to rate, shouldn\'t call')
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

    // Update per-day history bound to bundle
    const bundleId = head.bundleId
    const rkey = String(rating)
    const h = (await db.history.get([bundleId, this.day])) || {
      bundleId,
      day: this.day,
      studied: 0,
      ratings: {}
    }
    h.studied += 1
    h.ratings[rkey] = (h.ratings[rkey] || 0) + 1
    // Sync time only on rate
    h.ttd = this.ttd
    await db.history.put(h)

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
      log.warn('No FSRS history to revert, shouldn\'t call')

    this.queue.unshift(this.queue.pop())
    this._flush(['queue'])
    return tail
  }

  isFinished() {
    return Array.isArray(this.queue) && this.queue[0] === null
  }
}

log.debug('StudyEngine2 module loaded')
export async function createEngine(prefs, store) {
  const eng = new StudyEngine2(prefs, store)
  // hydrate the queue
  if (Array.isArray(eng.queue))
    eng.queue = await Promise.all(eng.queue.map(async c =>
      c?.id ? await db.cards.get(c.id) : null))

  await eng._bump()
  log.info('StudyEngine2 initialized')
  return eng
}
