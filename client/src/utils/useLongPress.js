import { useRef, useCallback } from 'react'

// Unified long/short press hook
// handler(e, type) where type is 'long' | 'short'
export const useLongPress = (handler, { delay = 500, moveThreshold = 10 } = {}) => {
  const timer = useRef(null)
  const isLong = useRef(false)
  const suppressMouseUntil = useRef(0)
  const pressing = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const moved = useRef(false)

  const getPoint = (e) => {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const start = useCallback((e) => {
    // If a touch just happened, ignore the synthetic mouse sequence
    if (e.type === 'mousedown') {
      const now = Date.now()
      if (now < suppressMouseUntil.current) return
    }

    // Prevent duplicate timers
    if (timer.current || pressing.current) return

    clear()

    isLong.current = false
    moved.current = false
    pressing.current = true
    startPos.current = getPoint(e)
    if (e.type === 'touchstart') {
      // Arm mouse suppression window for synthetic mouse events that follow touch
      suppressMouseUntil.current = Date.now() + 800
    }

    timer.current = setTimeout(() => {
      isLong.current = true
      handler?.(e, 'long')
    }, delay)
  }, [handler, delay, clear])

  const move = useCallback((e) => {
    if (!pressing.current) return
    if (isLong.current) return
    if (!timer.current) return
    const p = getPoint(e)
    const dx = Math.abs(p.x - startPos.current.x)
    const dy = Math.abs(p.y - startPos.current.y)
    if (Math.max(dx, dy) > moveThreshold) {
      moved.current = true
      clear()
    }
  }, [moveThreshold, clear])

  const end = useCallback((e) => {
    if (!pressing.current) return
    // Any touch end should extend mouse suppression window a bit
    if (e.type === 'touchend') {
      suppressMouseUntil.current = Date.now() + 800
    }

    // Ignore synthetic mouseup after touch
    if (e.type === 'mouseup' && Date.now() < suppressMouseUntil.current) {
      return
    }

    clear()

    if (!isLong.current && !moved.current) {
      handler?.(e, 'short')
    }

    // Reset for next interaction
    isLong.current = false
    moved.current = false
    pressing.current = false
  }, [handler, clear])

  return {
    handlers: {
      onMouseDown: start,
      onMouseUp: end,
      onMouseMove: move,
      onTouchStart: start,
      onTouchEnd: end,
      onTouchMove: move,
      onContextMenu: (e) => e.preventDefault()
    },
    isLongPress: isLong.current
  }
}
