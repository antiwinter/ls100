import { useRef, useCallback } from 'react'

// Extract position from touch/mouse event
const getPos = (e) => ({ 
  x: e.touches ? e.touches[0].clientX : e.clientX,
  y: e.touches ? e.touches[0].clientY : e.clientY 
})

// Calculate distance between two points
const getDist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

// Unified long/short press hook
// handler(e, type) where type is 'long' | 'short'
export const useLongPress = (handler, { delay = 500, moveThreshold = 10 } = {}) => {
  const timer = useRef(null)
  const resetTimer = useRef(null) 
  const isLong = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const moved = useRef(false)

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    timer.current = resetTimer.current = null
  }, [])

  const shouldClick = () => !isLong.current && !moved.current

  const start = useCallback((e) => {
    clear()
    isLong.current = moved.current = false
    startPos.current = getPos(e)
    
    timer.current = setTimeout(() => {
      isLong.current = true
      handler?.(e, 'long')
    }, delay)
  }, [handler, delay, clear])

  const move = useCallback((e) => {
    if (!timer.current) return
    
    if (getDist(getPos(e), startPos.current) > moveThreshold) {
      moved.current = true
      clear()
    }
  }, [moveThreshold, clear])

  const end = useCallback((_e) => {
    clear()
    
    // Don't call onClick here - let handleClick be the single source of truth
    // if (shouldClick()) onClick?.(e)  ← REMOVED
    
    // Delay reset for PC mouse events (onMouseUp fires before onClick)
    if (isLong.current) {
      resetTimer.current = setTimeout(() => {
        isLong.current = moved.current = false
        resetTimer.current = null
      }, 0)
    } else {
      isLong.current = moved.current = false
    }
  }, [clear])

  const handleClick = useCallback((e) => {
    if (shouldClick()) handler?.(e, 'short')
  }, [handler])

  return {
    handlers: {
      onMouseDown: start,
      onMouseUp: end, 
      onMouseMove: move,
      onMouseLeave: clear,
      onTouchStart: start,
      onTouchEnd: end,
      onTouchMove: move,
      onClick: handleClick,
      onContextMenu: (e) => e.preventDefault()
    },
    isLongPress: isLong.current
  }
} 