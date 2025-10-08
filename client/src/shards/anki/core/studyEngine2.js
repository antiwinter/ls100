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

    // setup engine time
    const offs = (this.prefs.dailyResetTime || 0) * 60 +
    new Date().getTimezoneOffset() // tz fix
    const ts = Date.now() / 1000 / 3600 - offs / 60
    this.today = Math.floor(ts / 24)
    this.nextReset = ((this.today + 1) * 24 * 60 + offs) * 60 * 1000

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
       k.match(/queue|buried/i) ? this[k].map(c => c?.id ?? null)
         : this[k]
    }
    this.store.setState(payload)
  }

  async _buildQueue() {
    const due = this.prefs.naturalCooldown ? Date.now() : this.nextReset

    // Collect cards
    let review = await db.cards
      .where('bundleId').equals(this.bundleId)
      .and(c => c.state !== 'New' && c.due <= due)
      .sortBy('due')

    let fresh = await db.cards
      .where('bundleId').equals(this.bundleId)
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

    // Sentinel marks end-of-session when it reaches the front
    this.queue = [...q.map(c => ({ ...c,
      // all learn in this session
      due: Date.now() })), null]
    log.debug('StudyEngine2 queue built', { length: q.length })
  }

  async _bump() {

    await this._buildQueue()
    this.day = this.today
    this.actions = []
    this.buried = []
    // reset time tracking for new day
    this._tt?.destroy()
    this._tt = new TimeTracker({ onSlice: this._trackTime })
    this._flush(['day', 'queue', 'actions', 'buried'])
  }

  async _update(card, op) {
    const now = new Date()
    if (Number.isFinite(op)) {
      const rating = Math.max(1, Math.min(4, op)) // clamp (FSRS uses 1-4)
      const next = fsrs.repeat(card.fsrs?.[0] || createEmptyCard(now), now)[rating]
      card.fsrs ||= []
      card.fsrs.unshift({
        ...next.card,
        rating,
        response_time: this._drawTs ? now.getTime() - this._drawTs : 0
      })
    } else if (op === 'suspend')
      card.suspend = 1


    // update card
    card.due = card.fsrs[0]?.due || now.getTime()
    card.state = card.fsrs[0]?.state || 'New'
    await db.cards.update(card.id, card)
    return  card.due - now.getTime()
  }

  // Cards only, exclude sentinel
  cards() {
    return (this.queue || []).filter(Boolean)
  }

  // Stamp draw time for response_time tracking; UI may call this when showing the card
  draw() {
    // don't pollute the queue
    this._drawTs = Date.now()
    let hand = null
    for (const c of (this.queue || [])) {
      if (!c) break
      if (c.due <= this._drawTs)
        return c

      if (!hand || c.due < hand.due)
        hand = c
    }
    // if no inSessionCooldown, return the next due card
    return !this.prefs.naturalCooldown && hand
  }

  async rate(card, rating) {
    // Remove card and decide where to insert
    const x = this.queue.findIndex(c => c.id === card.id)
    if (x < 0) {
      log.error('Rating card not in queue', card, this.queue)
      return
    }


    const gap = await this._update(card, rating)

    this.queue.splice(x, 1)
    const { gradGap = 24 * 60 } = this.prefs
    if (gap > gradGap * 60 * 1000) {
      // Graduated or suspend? Push to back
      this.queue.push(card)
    } else {
      // Push to front, draw() auto skip cooldown
      this.queue.unshift(card)
    }

    this.actions.unshift(card.id)
    this._flush(['queue', 'actions'])

    // Update per-day history bound to bundle
    const bundleId = card.bundleId
    const h = (await db.history.get([bundleId, this.day])) || {
      bundleId,
      day: this.day,
      studied: 0,
      ratings: {}
    }
    h.studied += 1
    h.ratings[rating] = (h.ratings[rating] || 0) + 1
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
    await this._update(card)
    card.due = Date.now()
    this.queue.splice(idx, 1)
    this.queue.unshift(card)
    this.actions.shift()
    this._flush(['queue', 'actions'])
    return card
  }

  async reset(rebuild = false) {
    if (!rebuild) {
      let guard = 0
      while (this.actions.length) {
        guard += 1
        const undone = await this.undo()
        if (!undone || guard > 2048) break
      }
      this.buried = []
      this.day = null
      this.queue = null
      this.actions = []
      this.ttd = null
      this._tt?.destroy()
      this._tt = null
      this._flush(['day', 'queue', 'actions', 'ttd', 'buried'])
      await this._bump()
      return
    }

    await this._buildQueue()
    this.day = this.today
    if (Array.isArray(this.queue)) {
      const done = new Set(this.actions)
      const filtered = this.queue.filter(card => card === null || !done.has(card.id))
      if (!filtered.length || filtered[filtered.length - 1] !== null) filtered.push(null)
      this.queue = filtered
    }
    this.buried = []
    if (!this._tt) {
      this._tt = new TimeTracker({ ttd: this.ttd, onSlice: this._trackTime })
    }
    this._flush(['day', 'queue', 'buried'])
  }

  async bury(card) {
    if (!card?.id) return
    if (!Array.isArray(this.queue)) return
    const idx = this.queue.findIndex(c => c?.id === card.id)
    if (idx >= 0) {
      this.queue.splice(idx, 1)
    }
    if (!this.buried.includes(card.id)) {
      this.buried.push(card.id)
    }
    this._flush(['queue', 'buried'])
  }

  async suspend(card) {
    if (!card) return
    await db.cards.update(card.id, { suspend: 1, state: 'Suspended' })
    if (!Array.isArray(this.queue)) return
    const idx = this.queue.findIndex(c => c?.id === card.id)
    if (idx >= 0) {
      this.queue.splice(idx, 1)
      if (!this.queue.length || this.queue[this.queue.length - 1] !== null) {
        this.queue.push(null)
      }
      this._flush(['queue'])
    }
  }

  status() {
    const cooldowns = []
    for (const c of this.queue || []) {
      if (!c) break
      cooldowns.push(c.due)
    }

    return {
      done: this.queue?.[0] === null,
      cooldowns
    }
  }

  exit() {
    this._tt?.destroy()
    this._tt = null
  }
}

log.debug('StudyEngine2 module loaded')
export async function createEngine(prefs, store) {
  const eng = new StudyEngine2(prefs, store)

  // Hydrate queue
  const _hydrate = async (q = []) => {
    return await Promise.all(q.map(async id =>
      id ? await db.cards.get(id) : null))
  }
  eng.queue = await _hydrate(eng.queue)
  eng.buried = await _hydrate(eng.buried)

  if (!this.day // first run
    || this.day !== this.today // new day
    || !Array.isArray(this.queue) // bad queue
  )
    await eng._bump()

  log.info('StudyEngine2 initialized')
  return eng
}
