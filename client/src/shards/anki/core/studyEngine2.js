import _ from 'lodash'
import { FSRS, createEmptyCard } from 'ts-fsrs'
import db from './db.js'
import { log } from '../../../utils/logger.js'
import { TimeTracker } from '../../../utils/timeTracker.js'

const fsrs = new FSRS()

function mix(dst = [], src) {
  if (!src?.length) return

  // N random positions
  const pos = _.shuffle(_.range(0, dst.length + 1))
    .slice(0, src.length)     // Take first N positions (N = src.length)
    .sort((a, b) => a - b)    // Sort ascending for sequential insertion

  src.forEach((x, i) => {
    dst.splice(pos[Math.min(i, pos.length - 1)] + i, 0, x)  // +i adjusts for previous insertions
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
      this.actions = []
      // reset time tracking for new day
      this._tt?.destroy()
      this._tt = new TimeTracker({ onSlice: this._trackTime })
      this._flush(['day', 'queue', 'actions'])
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

    // clamp rating (FSRS uses 1-4: Again, Hard, Good, Easy)
    rating = Math.max(1, Math.min(4, rating))

    const now = new Date()
    const next = fsrs.repeat(head.fsrs?.[0] || createEmptyCard(Date.now()), now)[rating]
    head.fsrs ||= []
    const rt = this._drawTs ? now.getTime() - this._drawTs : 0
    head.fsrs.unshift({
      ...next.card,
      rating,
      response_time: rt
    })

    await db.cards.update(head.id, { fsrs: head.fsrs })

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

    // Remove head and decide where to insert
    this.queue.shift()

    const { gradGap = 10 } = this.prefs
    let idx = 0
    if (next.card.due - now.getTime() > gradGap * 60 * 1000) {
      // Graduated? Push to back (before sentinel)
      idx = this.queue.length - 1
    } else {
      // Insert before sentinel, maintaining due order
      for (const [i, v] of this.queue.entries()) {
        if (v === null || v.due > head.due) {
          idx = i
          break
        }
      }
    }

    this.queue.splice(idx, 0, head)
    this.actions.unshift(idx)
    this._flush(['queue', 'actions'])
  }

  async undo() {
    const idx = this.actions[0]
    if (idx === undefined) return null
    const card = this.queue[idx]
    if (!card || !card.fsrs?.length) {
      log.error('Undo actions are broken, CLEARED')
      this.actions = []
      this._flush(['actions'])
      return null
    }

    // dangers eliminated, do them all
    card.fsrs.shift()
    await db.cards.update(card.id, { fsrs: card.fsrs })
    this.queue.splice(idx, 1)
    this.queue.unshift(card)
    this.actions.shift()
    this._flush(['queue', 'actions'])
    return card
  }

  isFinished() {
    return Array.isArray(this.queue) && this.queue[0] === null
  }

  exit() {
    this._tt?.destroy()
  }
}

log.debug('StudyEngine2 module loaded')
export async function createEngine(prefs, store) {
  const eng = new StudyEngine2(prefs, store)

  // Hydrate queue
  if (eng.queue)
    eng.queue = await Promise.all(eng.queue.map(async id =>
      id ? await db.cards.get(id) : null))

  await eng._bump()
  log.info('StudyEngine2 initialized')
  return eng
}
