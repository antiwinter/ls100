// Minimal time tracker with fixed tick and compact ttd shape
// ttd: { base: unix_sec, total: secs, slices: [[t0, t1], ...] }
export class TimeTracker {
  constructor({ ttd, onSlice, tickSec = 5, idleGapSec = 30 } = {}) {
    this.base = ttd?.base || Math.floor(Date.now() / 1000)
    // normalize: ensure t1 is numeric; if missing, set to t0 (zero-length to start)
    this.slices = (ttd?.slices || []).map(([t0, t1]) => [t0 || 0, (t1 == null ? (t0 || 0) : t1)])
    this.onSlice = onSlice
    this._tickSec = Math.max(1, tickSec)
    this._idleGapSec = Math.max(1, idleGapSec)
    this._timer = null

    // periodic tick
    this._timer = setInterval(() => this._tick(), this._tickSec * 1000)
  }

  _nowOffs() {
    return Math.floor(Date.now() / 1000) - this.base
  }

  total() {
    let sum = 0
    for (const [t0, t1] of this.slices) {
      sum += Math.max(0, (t1 - (t0 || 0)))
    }
    return sum
  }

  _emit(slice) {
    this.onSlice?.(slice, { base: this.base, total: this.total(), slices: this.slices })
  }

  _tick() {
    const now = this._nowOffs()
    const last = this.slices[this.slices.length - 1]

    if (!last || (now - last[1]) >= this._idleGapSec) {
      const s = [now, now + this._tickSec]
      this.slices.push(s)
      this._emit(s)
    } else if (!document?.hidden) {
      last[1] = now
      this._emit(last)
    }
  }

  destroy() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }
}
