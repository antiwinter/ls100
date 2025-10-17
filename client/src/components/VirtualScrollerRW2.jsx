import React, { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'
import { List, useDynamicRowHeight } from 'react-window'
import { log } from '../utils/logger.js'

// Virtual scroller using react-window v2 API
// Designed for subtitle viewer with dynamic row heights

export const VirtualScrollerRW = forwardRef(({
  name = 'vs-rw2',
  totalCount = 0,
  overscan,
  item,
  onRangeChange,
  onAnchored,
  onScroll
}, ref) => {
  const listRef = useRef(null)
  const seekPending = useRef(-2)
  const rangeRef = useRef({ })

  //   log.debug('RW2 re-render', { name, totalCount, overscan })
  const checkAndSeek = useCallback(() => {
    if (seekPending.current < 0) return
    if (listRef.current) {
      listRef.current?.scrollToRow({ index: seekPending.current, behavior: 'auto' })
      seekPending.current = -1
      onAnchored?.()
    }
  }, [listRef, onAnchored])

  useImperativeHandle(ref, () => ({
    seek: (index = 0, _layoutChange) => {
      log.debug('RW2 Imperative seek', { index })
      seekPending.current = index
      checkAndSeek()
    }
  }), [checkAndSeek])

  const handleRowsRendered = useCallback((visibleRows, _allRows) => {
    // V2 API provides visibleRows and allRows
    const r = rangeRef.current = visibleRows
    // log.debug('RW2 rowsRendered', r)

    if (seekPending.current > -2) {
    // seeked
      onRangeChange?.({ ...r, end: r.startIndex <= 0 ?
        'front' : r.stopIndex >= totalCount - 1
          ? 'end' : null })
    }

    // Check if we've reached the seek target (only if seeking)
    checkAndSeek()
  }, [onRangeChange, totalCount, checkAndSeek])

  const handleScroll = useCallback((info) => {
    onScroll?.(info)
  }, [onScroll])

  // Rows just render their content normally - react-window measures automatically
  const RowComponent = useCallback(({ index, style }) => (
    <div style={{ ...style }} data-vs-index={index}>
      {item?.({ index })}
    </div>
  ), [item])

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 30,
    key: name
  })

  return (
    <div style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}>
      <List
        listRef={listRef}
        rowCount={totalCount}
        rowHeight={rowHeight}
        overscanCount={overscan}
        onRowsRendered={handleRowsRendered}
        onScroll={handleScroll}
        rowComponent={RowComponent}
        rowProps={{}}
      />
    </div>
  )
})

VirtualScrollerRW.displayName = 'VirtualScrollerRW2'
export default VirtualScrollerRW

