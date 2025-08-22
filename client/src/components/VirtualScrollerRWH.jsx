import React, { forwardRef, useImperativeHandle,
  useRef, useEffect, useCallback, useState, createPortal } from 'react'
import { VariableSizeList as List } from 'react-window'
import { log } from '../utils/logger.js'

// this is written by human

export const VirtualScrollerRW = forwardRef(({
  name = 'vs',
  totalCount = 0,
  overscan,
  item,
  onRangeChange,
  onAnchored,
  onScroll
  // no size hints from parent; we adapt dynamically
}, ref) => {
  const containerRef = useRef(null)
  const listRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const sizeMapRef = useRef(new Map())
  const [anchor, setAnchor] = useState(0)
  const anchorRef = useRef(null)

  // Fixed estimated size for stability
  const ESTIMATED_SIZE = 30

  useEffect(() => {
    anchorRef.current = anchor
  }, [anchor])

  log.debug('RW re-render', { name, totalCount, overscan })
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

  const measure = useCallback((index, el, mode = '') => {
    if (!el) return
    const _measure = () => {
      const h = el.scrollHeight || el.offsetHeight || el.getBoundingClientRect().height || 0
      const prev = sizeMapRef.current.get(index)
      sizeMapRef.current.set(index, h)

      log.debug('RW measure', mode, { index, h, prev, el })
      if (index === anchorRef.current) {
        listRef.current?.resetAfterIndex(0, true)
        listRef.current?.scrollToItem(index, 'start')
        anchorRef.current = null
        onAnchored?.()
      }
    }
    // Measure immediately and then observe for changes
    requestAnimationFrame(_measure)
    // const ro = new ResizeObserver(measure)
    // ro.observe(el)
  }, [])

  // Pre-calculate heights component
  const SilentMeasure = ({ update }) => {
    const [index, setIndex] = useState(0)

    useEffect(() => {
      // Measure current item and move to next
      const timer = setTimeout(() => {
        setIndex(prev => prev + 1)
      }, 0)

      return () => clearTimeout(timer)
    }, [index, update])

    if (index >= totalCount) return null
    return createPortal(
      <div style={{ position: 'absolute', top: -9999, left: -9999, width: size.width, visibility: 'hidden' }}>
        <div ref={(el) => measure(index, el, 'silent')} style={{ overflow: 'hidden', maxWidth: '100%' }}>
          <div>
            {item?.({ index })}
          </div>
        </div>
      </div>,
      document.body
    )
  }

  useImperativeHandle(ref, () => ({
    seek: (index, layoutChange = false) => {
      log.debug('RW scrollToIndex', { index, layoutChange })
      if (layoutChange) {
        setAnchor(index)
        return
      } else {
        listRef.current?.scrollToItem(index, 'start')
      }
    }
  }), [])

  const itemKey = useCallback((index) => `vs_${name}__${index}`, [name])
  const itemHeight = useCallback((index) => {
    return sizeMapRef.current.get(index) || ESTIMATED_SIZE
  }, [])

  const renderItem = useCallback(({ index, style: itemStyle }) => (
    <div style={{ ...itemStyle, overflow: 'hidden', maxWidth: '100%' }} data-vs-index={index}>
      <div ref={(el) => measure(index, el)}>
        {item?.({ index })}
      </div>
    </div>
  ), [item, measure])

  const handleItemsRendered = useCallback(({
    visibleStartIndex: startId, visibleStopIndex:  stopId }) => {
    // Retry a few frames until the visible start equals target, then lock
    log.debug('RW handleItemsRendered', { startId, stopId })
    let end = startId <= 0 ? 'front' : stopId >= totalCount - 1 ? 'end' : null
    onRangeChange?.({ startId, stopId, end })
  }, [onRangeChange, totalCount])

  const handleScroll = useCallback((scrollProps) => {
    onScroll?.(scrollProps)
  }, [onScroll])

  return (
    <div ref={containerRef}  style={{ width: '100%', height: '100%' }}>
      {size.height > 0 && (
        <List
          ref={listRef}
          height={size.height}
          width={size.width || '100%'}
          itemCount={totalCount}
          itemSize={itemHeight}
          itemKey={itemKey}
          estimatedItemSize={ESTIMATED_SIZE}
          overscanCount={overscan}
          onItemsRendered={handleItemsRendered}
          onScroll={handleScroll}
          style={{ overflowX: 'hidden', overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {renderItem}
        </List>
      )}
      {size.height > 0 && <SilentMeasure update={anchor} />}
    </div>
  )
})

VirtualScrollerRW.displayName = 'VirtualScrollerRW'
export default VirtualScrollerRW
