import { log } from './logger.js'

export class TimeSegments {
  constructor(options = {}) {
    this.segments = []
    this.autoIdleDetection = options.autoIdleDetection ?? true
    this._visibilityHandler = null

    if (this.autoIdleDetection && typeof document !== 'undefined') {
      this._setupVisibilityListener()
    }
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
  }

  close() {
    const last = this.segments[this.segments.length - 1]
    if (!last || last.end) {
      log.debug('TimeSegments: no open segment to close')
      return
    }

    last.end = Date.now()
    log.debug('TimeSegments: closed segment')
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

  _setupVisibilityListener() {
    this._visibilityHandler = () => {
      if (document.hidden) {
        this.close()
      } else {
        this.open()
      }
    }
    document.addEventListener('visibilitychange', this._visibilityHandler)
  }

  destroy() {
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler)
      this._visibilityHandler = null
    }
    this.close() // Close any open segment
  }
}
