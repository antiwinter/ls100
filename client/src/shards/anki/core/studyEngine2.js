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
  return dst
}

export class StudyEngine2 {
  constructor(prefs, store) {
    this.prefs = prefs || {}
    this.store = store
    Object.assign(this, store.getState())
  }

  async _init() {
    // setup engine time
    const offs = (this.prefs.dailyResetTime || 0) * 60 +
        new Date().getTimezoneOffset() // tz fix
    const ts = Date.now() / 1000 / 3600 - offs / 60
    this.today = Math.floor(ts / 24)
    this.nextReset = ((this.today + 1) * 24 * 60 + offs) * 60 * 1000

    if (!this.day // first run
      || this.day !== this.today // new day
      || !Array.isArray(this.queue) // bad queue
    ) {
      this.day = this.today
      this.ttd = undefined
      this.queue = [null]
      this.actions = []
      await this._fill()
      // reset time tracking for new day
      this._flush(['day', 'queue', 'actions'])
    }

    // time tracking (auto-open, auto-idle)
    this._tt?.destroy()
    this._tt = new TimeTracker({
      ttd: this.ttd,
      onSlice: (_, ttd) => {
        this.ttd = ttd
        this._flush(['ttd'])
      }
    })
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

  async _fill(n = this.prefs.maxNewCards, m = this.prefs.maxReviewCards) {
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

    this._sort(fresh.slice(0, n),review.slice(0, m))
    log.debug('StudyEngine2 queue built', this.queue)
  }

  // 1. sort and insert to queue
  // 2. bigsort all queue
  _sort(fresh = [], review = []) {
    if (!(fresh.length + review.length)) {
      fresh = this.queue.filter(c => c?.state === 'New')
      review = this.queue.filter(c => c?.state !== 'New')
      this.queue = [null]
    }

    const { newReviewOrder } = this.prefs
    const q = newReviewOrder === 'new-first' ? [...fresh, ...review] :
      newReviewOrder === 'mixed' ? mix(review, fresh) :
        [...review, ...fresh]

    this.queue.unshift(...q.map(c => ({ ...c, due: Date.now() })))
  }

  async _schedule(card, op, inv) {
    const now = Date.now()

    if (op === 'bury')
      return Infinity

    if (op === 'suspend')
      card.suspend = !inv || undefined
    else if (Number.isFinite(op)) {
      card.fsrs ||= []
      if (inv > 1) {
        card.fsrs = card.fsrs.filter(f => !f.last_review ||
          f.last_review < this.today * 24 * 3600_000)
      } else if (inv) {card.fsrs.shift() } else {
        const rating = Math.max(1, Math.min(4, op)) // clamp (FSRS uses 1-4)
        const next = fsrs.repeat(card.fsrs?.[0] || createEmptyCard(now), now)[rating].card
        card.fsrs.unshift({
          ...next,
          rating,
          due: next.due.getTime(),
          last_review: now,
          response_time: this._drawTs ? now - this._drawTs : 0
        })
      }

      // update card
      card.due = card.fsrs[0]?.due || now
      card.state = card.fsrs[0]?.state || 'New'
    } else
      log.warn('undifined op', card, op)

    await db.cards.update(card.id, card)
    return card.due - now
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

  _detach(id) {
    // Remove card and decide where to insert
    const x = this.queue.findIndex(c => c?.id === id)
    if (x < 0) {
      log.error('Rating card not in queue', id, this.queue)
      return null
    }
    return this.queue.splice(x, 1)[0]  // Return the card object, not array
  }

  async schedule(card, op) {
    // Remove card and decide where to insert
    card = this._detach(card.id)
    if (!card) return

    const gap = await this._schedule(card, op)
    const { gradGap = 24 * 60 } = this.prefs
    if (gap > gradGap * 60 * 1000) {
      // Graduated or suspend/bury? Push to back
      this.queue.push(card)
    } else {
      // Push to front, draw() auto skip cooldown
      this.queue.unshift(card)
    }

    this.actions.unshift({ op, id: card.id })
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
    h.ratings[op] = (h.ratings[op] || 0) + 1
    // Sync time only on rate
    h.ttd = this.ttd
    await db.history.put(h)
  }

  async undo() {
    const { id, op } = this.actions.shift() || {}
    const card = this._detach(id)
    if (!card) {
      this._flush(['actions'])
      return null
    }

    // dangers eliminated, do them all
    await this._schedule(card, op, 1) // revert card op
    card.due = Date.now() // reset cd, (in-mem only)
    this.queue.unshift(card) // move to front, attached
    this._flush(['queue', 'actions'])
    return card
  }

  async reset() {
    this.actions = []
    await Promise.all(this.queue.map(c =>
      c?.id ? this._schedule(c, 1, 2) : Promise.resolve()
    ))
    this._sort()
    this._flush(['actions', 'queue'])
  }

  async extend(n, m) {
    if (this.queue[0] != null) {
      log.warn('Session not ended, unable to extend', this.queue)
      return
    }

    await this._fill(n, m)
    this._flush(['queue'])
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
  eng.queue  = await Promise.all(eng.queue.map(async id =>
    id ? await db.cards.get(id) : null))

  await eng._init()

  log.info('StudyEngine2 initialized')
  return eng
}
