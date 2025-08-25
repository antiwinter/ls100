import React, { forwardRef, useImperativeHandle,
  useRef, useEffect, useCallback, useState } from 'react'
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
  const [size, setSize] = useState({ width: 0, height: 0 })
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const sizeMapRef = useRef(new Map())
  const seekPending = useRef(-1)
  const rangeRef = useRef({ })
  const cleanRange = useRef({})
  const scrollInfo = useRef(null)
  const settled = useRef(null)

  // Fixed estimated size for stability
  const ESTIMATED_SIZE = 30
  log.debug('RWH re-render', { name, totalCount, overscan })

  const fixLayout = useCallback((manual) => {
    const _fix = () => {
      // log.debug('RWH fixLayout', manual, { ...rangeRef.current,
      // ...cleanRange.current, ...scrollInfo.current })


      const { visibleStartIndex, visibleStopIndex,
        overscanStartIndex, overscanStopIndex } = rangeRef.current
      const c = cleanRange.current

      if (manual) {
        log.debug('RWH manual refresh')
        listRef.current?.resetAfterIndex(overscanStartIndex, true)
        return
      }

      if (c.start === undefined ||
        (c.start && scrollInfo.current?.scrollDirection !== 'forward'
          && visibleStartIndex - c.start < 10)) {
        let snap = visibleStartIndex
        listRef.current?.resetAfterIndex(overscanStartIndex, true)
        listRef.current?.scrollToItem(snap, 'start')
        c.start = overscanStartIndex
        c.stop = overscanStopIndex
        log.debug('RWH refresh above ->', { overscanStartIndex, snap })
      } else if (c.stop - visibleStopIndex < 10
        && scrollInfo.current?.scrollDirection !== 'backward'
        && c.stop !== totalCount - 1) {
        log.debug('RWH refresh below ->', visibleStartIndex)
        listRef.current?.resetAfterIndex(visibleStartIndex, true)
        c.stop = overscanStopIndex
        c.start = Math.max(c.start, overscanStartIndex)
      }
    }

    if (settled.current)
      clearTimeout(settled.current)
    settled.current = setTimeout(() => {
      // log.debug('RWH settled')
      settled.current = null
      _fix()
    }, 20)
  }, [totalCount])

  const checkAndSeek = useCallback(() => {
    if (seekPending.current < 0) {
      log.debug('RWH seek skip')
      return
    }
    log.debug('RWH seek pending', { seekPending: seekPending.current, ...rangeRef.current })
    let delta = seekPending.current - rangeRef.current.visibleStartIndex
    if (delta >= 0 && delta <= 5) {
      seekPending.current = -1
      log.debug('RWH seek cleared')
      onAnchored?.()
      return
    }
    let to = seekPending.current
    requestAnimationFrame(() => {
      log.debug('RWH seek issue', to)
      if (Number.isInteger(to))
        listRef.current?.scrollToItem(to, 'start')
      checkAndSeek()
    })
  }, [onAnchored])

  // Resize observer to measure container
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect
      setSize({ width: Math.ceil(cr.width), height: Math.ceil(cr.height) })
      log.debug('RWH resize', { w: Math.ceil(cr.width), h: Math.ceil(cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const measure = useCallback((index, el) => {
    if (!el) return
    // log.debug('RWH measure', mode, { index, el })
    const _measure = () => {
      const { h: _h } = sizeMapRef.current.get(index) || { h: ESTIMATED_SIZE }
      const h = el.scrollHeight || el.offsetHeight || el.getBoundingClientRect().height || 0
      const x = { h, offs: h - _h }
      sizeMapRef.current.set(index, x)

      fixLayout()
      // log.debug('RWH measure', mode, { index, h, _h, offset: scrollInfo.current?.scrollOffset,
      //   w: el.getBoundingClientRect().width, el })
    }
    // Measure immediately and then observe for changes
    requestAnimationFrame(_measure)
    // const ro = new ResizeObserver(measure)
    // ro.observe(el)
  }, [fixLayout])

  useImperativeHandle(ref, () => ({
    seek: (index, layoutChange) => {
      log.debug('RWH Imperative seek', { index, layoutChange })
      seekPending.current = index
      if (layoutChange) {
        cleanRange.current = { start: undefined }
      }
      checkAndSeek()
      fixLayout(1)
    }
  }), [checkAndSeek, fixLayout])

  const itemKey = useCallback((index) => `vs_${name}__${index}`, [name])
  const itemHeight = useCallback((index) => {
    return sizeMapRef.current.get(index)?.h || ESTIMATED_SIZE
  }, [])

  const renderItem = useCallback(({ index, style: itemStyle }) => (
    <div style={{ ...itemStyle, overflow: 'hidden', maxWidth: '100%' }} data-vs-index={index}>
      <div ref={(el) => measure(index, el)}>
        {item?.({ index })}
      </div>
    </div>
  ), [item, measure])

  const handleItemsRendered = useCallback((r) => {
    // Retry a few frames until the visible start equals target, then lock
    // log.debug('RWH handleItemsRendered', { start, stop })
    rangeRef.current = r
    onRangeChange?.({ ...r, end: r.visibleStartIndex <= 0 ?
      'front' : r.visibleStopIndex >= totalCount - 1
        ? 'end' : null })
  }, [onRangeChange, totalCount])

  const handleScroll = useCallback((info) => {
    scrollInfo.current = info
    onScroll?.()
  }, [onScroll])

  return (
    <div ref={boxRef}  style={{ width: '100%', height: '100%' }}>
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
        </List>)}
    </div>

  )
})

VirtualScrollerRW.displayName = 'VirtualScrollerRW'
export default VirtualScrollerRW
