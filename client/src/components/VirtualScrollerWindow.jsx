import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { VariableSizeList as List } from 'react-window'
import { log } from '../utils/logger.js'

// Minimal virtual scroller built on react-window (VariableSizeList)
// Keeps the same surface props as our Virtuoso-based scroller

export const VirtualScrollerRW = forwardRef(({ 
  totalCount = 0,
  itemContent,
  itemKey,
  onRangeChange,
  onStartReached,
  onEndReached,
  increaseViewportBy,
  onScroll,
  className,
  style,
  initialTopMostItemIndex,
  topItemIndex,
  // Variable size support
  itemSize,              // number | (index) => number
  estimatedItemSize = 60
}, ref) => {
  const containerRef = useRef(null)
  const listRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const sizeMapRef = useRef(new Map())
  const lastRangeRef = useRef({ s: -1, e: -1 })

  // Resize observer to measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect
      setSize({ width: Math.ceil(cr.width), height: Math.ceil(cr.height) })
      log.debug('RW resize', { w: Math.ceil(cr.width), h: Math.ceil(cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, align = 'start') => {
      listRef.current?.scrollToItem(index, align)
    },
    scrollTo: ({ top = 0 } = {}) => {
      listRef.current?.scrollTo(top)
    }
  }), [])

  const computeKey = useMemo(() => (
    typeof itemKey === 'function'
      ? (index) => itemKey(index)
      : (index) => index
  ), [itemKey])

  const overscanCount = useMemo(() => {
    const inc = increaseViewportBy
    const px = inc && typeof inc === 'object'
      ? Math.max(inc.top || 0, inc.bottom || 0)
      : Number(inc) || 0
    return Math.max(3, Math.ceil(px / (estimatedItemSize || 1)))
  }, [increaseViewportBy, estimatedItemSize])

  // Ensure initial index is visible
  useEffect(() => {
    if (!Number.isFinite(initialTopMostItemIndex)) return
    if (!listRef.current || size.height === 0) return
    // schedule after mount + measurement
    const id = requestAnimationFrame(() => {
      log.debug('RW scrollTo initial index', { index: initialTopMostItemIndex })
      listRef.current?.scrollToItem(initialTopMostItemIndex, 'start')
    })
    return () => cancelAnimationFrame(id)
  }, [initialTopMostItemIndex, size.height])

  const getSizeForIndex = useCallback((index) => {
    if (typeof itemSize === 'number') return itemSize
    if (typeof itemSize === 'function') return itemSize(index)
    const cached = sizeMapRef.current.get(index)
    return Number.isFinite(cached) ? cached : estimatedItemSize
  }, [itemSize, estimatedItemSize])

  const setMeasuredEl = useCallback((index, el) => {
    if (!el) return
    const measure = () => {
      // Prefer scrollHeight to capture full content height even if constrained
      const box = el
      const h = box.scrollHeight || box.offsetHeight || box.getBoundingClientRect().height || 0
      if (!Number.isFinite(h) || h <= 0) return
      const prev = sizeMapRef.current.get(index)
      if (prev !== h) {
        sizeMapRef.current.set(index, h)
        listRef.current?.resetAfterIndex(index, true)
        if (index < 10) log.debug('RW measure', { index, h })
      }
    }
    // Measure immediately and then observe for changes
    requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
  }, [])

  const renderItem = useCallback(({ index, style: itemStyle }) => (
    <div style={itemStyle} data-index={index}>
      <div ref={(el) => setMeasuredEl(index, el)}>
        {itemContent?.({ index })}
      </div>
    </div>
  ), [itemContent, setMeasuredEl])

  const handleItemsRendered = useCallback(({ visibleStartIndex, visibleStopIndex }) => {
    topItemIndex?.(visibleStartIndex)
    onRangeChange?.({ startIndex: visibleStartIndex, endIndex: visibleStopIndex })
    if (visibleStartIndex <= 0) onStartReached?.()
    if (visibleStopIndex >= totalCount - 1) onEndReached?.()
    const { s, e } = lastRangeRef.current
    if (s !== visibleStartIndex || e !== visibleStopIndex) {
      lastRangeRef.current = { s: visibleStartIndex, e: visibleStopIndex }
      log.debug('RW range', { s: visibleStartIndex, e: visibleStopIndex })
    }
  }, [topItemIndex, onRangeChange, onStartReached, onEndReached, totalCount])

  const handleScroll = useCallback((scrollProps) => {
    onScroll?.(scrollProps)
    // log at a low frequency
  }, [onScroll])

  return (
    <div ref={containerRef} className={className} style={{ ...style, width: '100%', height: '100%' }}>
      {size.height > 0 && (
        <List
          ref={listRef}
          height={size.height}
          width={size.width || '100%'}
          itemCount={totalCount}
          itemSize={getSizeForIndex}
          itemKey={(index) => computeKey(index)}
          estimatedItemSize={estimatedItemSize}
          overscanCount={overscanCount}
          onItemsRendered={handleItemsRendered}
          onScroll={handleScroll}
        >
          {renderItem}
        </List>
      )}
    </div>
  )
})

VirtualScrollerRW.displayName = 'VirtualScrollerRW'

export default VirtualScrollerRW


