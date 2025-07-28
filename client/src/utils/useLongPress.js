import { useRef, useCallback } from 'react'

export const useLongPress = (onLongPress, onClick, { delay = 500 } = {}) => {
  const timeoutRef = useRef(null)
  const isLongPressRef = useRef(false)

  const start = useCallback((e) => {
    isLongPressRef.current = false
    
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true
      onLongPress?.(e)
    }, delay)
  }, [onLongPress, delay])

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const end = useCallback((e) => {
    clear()
    
    // If it wasn't a long press, trigger click
    if (!isLongPressRef.current) {
      onClick?.(e)
    }
    
    isLongPressRef.current = false
  }, [clear, onClick])

  const handleClick = useCallback((e) => {
    // If long press wasn't triggered, handle as normal click
    if (!isLongPressRef.current) {
      onClick?.(e)
    }
  }, [onClick])

  const handlers = {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: end,
    onClick: handleClick,
    onContextMenu: (e) => e.preventDefault() // Prevent native context menu
  }

  return {
    handlers,
    isLongPress: isLongPressRef.current
  }
} 