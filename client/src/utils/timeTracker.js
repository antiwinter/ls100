import { log } from './logger.js'

export class TimeSegments {
  constructor(options = {}) {
    this.segments = options.segments || []
    this.autoIdleDetection = options.autoIdleDetection ?? true
    this.debounceMs = options.debounceMs ?? 60 * 1000 // 1 minute default
    this.onSegmentChange = options.onSegmentChange
    this._visibilityHandler = null
    this._debounceTimer = null

    if (this.autoIdleDetection && typeof document !== 'undefined') {
      this._setupVisibilityListener()
    }

    // Fire initial change to sync any restored segments
    this.onSegmentChange?.(this.segments, this.total())
  }

  open() {
    // Check if current tail is incomplete
    const last = this.segments[this.segments.length - 1]
    if (last && !last.end) {
      log.debug('TimeSegments: segment already open')
      return
    }

    this.segments.push({ start: Date.now(), end: null })
    log.debug('TimeSegments: opened new segment')
    this.onSegmentChange?.(this.segments)
  }

  close() {
    const last = this.segments[this.segments.length - 1]
    if (!last || last.end) {
      log.debug('TimeSegments: no open segment to close')
      return
    }

    last.end = Date.now()
    log.debug('TimeSegments: closed segment')
    this.onSegmentChange?.(this.segments)
  }

  total() {
    return this.segments.reduce((sum, segment) => {
      if (segment.start && segment.end) {
        return sum + (segment.end - segment.start)
      } else if (segment.start && !segment.end) {
        // Current open segment
        return sum + (Date.now() - segment.start)
      }
      return sum
    }, 0)
  }

  defer(cb) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = null
    }
    if (cb)
      this._debounceTimer = setTimeout(() => {
        cb()
      }, this.debounceMs)
  }

  _setupVisibilityListener() {
    this._visibilityHandler = () => {
      if (document.hidden) {
        this.defer(() => this.close())
      } else {
        // Clear the debounce timer when becoming visible (event debouncing)
        this.defer()
        this.open()
      }
    }
    document.addEventListener('visibilitychange', this._visibilityHandler)
  }

  destroy() {
    // Clear any pending timer
    this.defer()

    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler)
      this._visibilityHandler = null
    }
    this.close() // Close any open segment
  }
}
