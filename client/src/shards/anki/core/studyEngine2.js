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
    const offs = (this.prefs.dailyResetTime || 0) * 60 +
      new Date().getTimezoneOffset() // tz fix
    const ts = Date.now() / 1000 / 3600 - offs / 60
    return Math.floor(ts / 24)
  }

  async _buildQueue() {
    const offs = (this.prefs.dailyResetTime || 0) * 60 +
      new Date().getTimezoneOffset() // tz fix
    const due = ((this._getDay() + 1) * 24 * 60 + offs) * 60 * 1000

    // Collect cards
    let review = await db.cards
      .where('bundleId').anyOf(this.bundleIds)
      .and(c => c.state !== 'New' && c.due <= due)
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

    // Sentinel marks end-of-session when it reaches the card
    this.queue = [...q.map(c => ({ ...c,
      // all learn in this session
      due: Date.now() })), null]
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

  async _rate(card) {
    await db.cards.update(card.id, { fsrs: card.fsrs })
    card.due = card.fsrs[0]?.due || Date.now()
    card.state = card.fsrs[0]?.state || 'New'
  }

  // Cards only, exclude sentinel
  cards() {
    return (this.queue || []).filter(Boolean)
  }

  // Stamp draw time for response_time tracking; UI may call this when showing the card
  draw() {
    // don't pollute the queue
    this._drawTs = Date.now()
    return this.queue.find(c => c && c.due <= this._drawTs)
  }

  async rate(card, rating) {
    // clamp rating (FSRS uses 1-4: Again, Hard, Good, Easy)
    rating = Math.max(1, Math.min(4, rating))

    const now = new Date()
    const next = fsrs.repeat(card.fsrs?.[0] || createEmptyCard(Date.now()), now)[rating]
    card.fsrs ||= []
    const rt = this._drawTs ? now.getTime() - this._drawTs : 0
    card.fsrs.unshift({
      ...next.card,
      rating,
      response_time: rt
    })
    await this._rate(card)

    // Remove card and decide where to insert
    const x = this.queue.findIndex(c => c.id === card.id)
    this.queue.splice(x, 1)

    const { gradGap = 24 * 60 } = this.prefs
    if (next.card.due - now.getTime() > gradGap * 60 * 1000) {
      // Graduated? Push to back (before sentinel)
      this.queue.push(card)
    } else {
      // Push to front, draw() auto skip cooldown
      this.queue.unshift(card)
    }

    this.actions.unshift(card.id)
    this._flush(['queue', 'actions'])

    // Update per-day history bound to bundle
    const bundleId = card.bundleId
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
  }

  async undo() {
    const id = this.actions[0]
    if (id === undefined) return null
    const idx = this.queue.findIndex(c => c.id === id)
    const card = this.queue[idx]
    if (!card || !card.fsrs?.length) {
      log.error('Undo actions are broken, CLEARED')
      this.actions.shift()
      this._flush(['actions'])
      return null
    }

    // dangers eliminated, do them all
    card.fsrs.shift()
    await this._rate(card)
    card.due = Date.now()
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
