import React, { forwardRef, useImperativeHandle, useMemo, useRef, useEffect, useCallback, useState } from 'react'
import { VariableSizeList as List } from 'react-window'
// import { log } from '../utils/logger.js'

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
  topItemIndex
  // no size hints from parent; we adapt dynamically
}, ref) => {
  const containerRef = useRef(null)
  const listRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const sizeMapRef = useRef(new Map())
  const lastRangeRef = useRef({ s: -1, e: -1 })
  // Initial anchor refs
  const initIdxRef = useRef(initialTopMostItemIndex)
  const didInitScrollRef = useRef(false)
  const didSnapRef = useRef(false)
  const anchorDoneRef = useRef(false)
  const anchorTriesRef = useRef(0)
  const anchorStableRef = useRef(0)
  const ensureTriesRef = useRef(0)
  const ensureRafRef = useRef(0)
  // Fixed estimated size for stability
  const ESTIMATED_SIZE = 60

  // Resize observer to measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect
      setSize({ width: Math.ceil(cr.width), height: Math.ceil(cr.height) })
      // log.debug('RW resize', { w: Math.ceil(cr.width), h: Math.ceil(cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Reset anchoring when initial index changes
  useEffect(() => {
    initIdxRef.current = initialTopMostItemIndex
    didInitScrollRef.current = false
    didSnapRef.current = false
    anchorDoneRef.current = false
    anchorTriesRef.current = 0
    anchorStableRef.current = 0
  }, [initialTopMostItemIndex])

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, align = 'start') => {
      listRef.current?.scrollToItem(index, align)
    },
    scrollTo: ({ top = 0 } = {}) => {
      listRef.current?.scrollTo(top)
    },
    reanchorTo: (index) => {
      if (!Number.isFinite(index)) return
      initIdxRef.current = index
      didInitScrollRef.current = false
      didSnapRef.current = false
      anchorDoneRef.current = false
      anchorTriesRef.current = 0
      anchorStableRef.current = 0
      const run = () => {
        listRef.current?.scrollToItem(index, 'start')
        didInitScrollRef.current = true
      }
      if (!listRef.current || size.height === 0) requestAnimationFrame(run)
      else run()
    }
  }), [size.height])

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
    return Math.max(60, Math.ceil(px / (ESTIMATED_SIZE || 1)))
  }, [increaseViewportBy])

  // Ensure initial index is visible
  useEffect(() => {
    if (!Number.isFinite(initialTopMostItemIndex)) return
    ensureTriesRef.current = 0
    const tick = () => {
      if (!listRef.current || size.height === 0) {
        if (ensureTriesRef.current++ < 30) ensureRafRef.current = requestAnimationFrame(tick)
        return
      }
      // Ensure target is recorded before anchoring
      initIdxRef.current = Number(initialTopMostItemIndex)
      listRef.current.scrollToItem(initialTopMostItemIndex, 'start')
      didInitScrollRef.current = true
    }
    ensureRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ensureRafRef.current)
  }, [initialTopMostItemIndex, size.height])

  const getSizeForIndex = useCallback((index) => {
    const cached = sizeMapRef.current.get(index)
    return Number.isFinite(cached) ? cached : ESTIMATED_SIZE
  }, [])

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
        // if (index < 10) log.debug('RW measure', { index, h })

        // One-time post-measure snap once a prior range is measured
        const target = initIdxRef.current
        if (Number.isFinite(target)
          && index <= target
          && didInitScrollRef.current
          && !didSnapRef.current) {
          didSnapRef.current = true
          requestAnimationFrame(() => {
            // log.debug('RW post-measure snap', { target })
            listRef.current?.scrollToItem(target, 'start')
          })
        }

        // Keep estimated size fixed; no dynamic average to avoid drift during anchoring
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
    // Retry a few frames until the visible start equals target, then lock
    const target = initIdxRef.current
    const anchoring = didInitScrollRef.current && !anchorDoneRef.current
    const validTarget = Number.isFinite(target) && target > 0
    if (anchoring && validTarget) {
      if (visibleStartIndex === target) {
        anchorStableRef.current += 1
        if (anchorStableRef.current >= 2) {
          anchorDoneRef.current = true
          // log.debug('RW anchor locked', { target })
        }
      } else if (anchorTriesRef.current < 30) {
        anchorTriesRef.current += 1
        anchorStableRef.current = 0
        // Retry next frame to stabilize anchoring
        requestAnimationFrame(() => {
          listRef.current?.scrollToItem(target, 'start')
        })
      }
    }
    topItemIndex?.(visibleStartIndex)
    onRangeChange?.({ startIndex: visibleStartIndex, endIndex: visibleStopIndex })
    if (visibleStartIndex <= 0) onStartReached?.()
    if (visibleStopIndex >= totalCount - 1) onEndReached?.()
    const { s, e } = lastRangeRef.current
    if (s !== visibleStartIndex || e !== visibleStopIndex) {
      lastRangeRef.current = { s: visibleStartIndex, e: visibleStopIndex }
      // range changed
    }
  }, [topItemIndex, onRangeChange, onStartReached, onEndReached, totalCount])

  const handleScroll = useCallback((scrollProps) => {
    onScroll?.(scrollProps)
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
          estimatedItemSize={ESTIMATED_SIZE}
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


