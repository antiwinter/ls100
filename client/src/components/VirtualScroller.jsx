import React, { forwardRef, useImperativeHandle, useRef, useMemo, useCallback } from 'react'
import { Virtuoso } from 'react-virtuoso'

// Generic virtual scroller built on react-virtuoso
// Minimal API by design per coding rules
export const VirtualScroller = forwardRef(({
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
  initialTopMostItemIndex
}, ref) => {
  const vRef = useRef(null)

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, align = 'start') => {
      vRef.current?.scrollToIndex({ index, align })
    },
    scrollTo: (opts) => {
      vRef.current?.scrollTo(opts)
    }
  }), [])

  // Stable key resolver
  const computeKey = useMemo(() => (
    typeof itemKey === 'function'
      ? (index) => itemKey(index)
      : (index) => index
  ), [itemKey])

  // Custom scroller to surface onScroll/className/style
  const Scroller = useMemo(() => {
    const Comp = forwardRef((props, sRef) => {
      const { children, ...rest } = props
      return (
        <div
          ref={sRef}
          onScroll={onScroll}
          className={className}
          style={style}
          {...rest}
        >
          {children}
        </div>
      )
    })
    Comp.displayName = 'VSScroller'
    return Comp
  }, [onScroll, className, style])

  // Memoized item content to prevent recreating the function on every render
  const itemContentMemo = useCallback((index) => itemContent?.({ index }), [itemContent])

  return (
    <Virtuoso
      ref={vRef}
      totalCount={totalCount}
      computeItemKey={computeKey}
      itemContent={itemContentMemo}
      rangeChanged={onRangeChange}
      startReached={onStartReached}
      endReached={onEndReached}
      increaseViewportBy={increaseViewportBy}
      initialTopMostItemIndex={initialTopMostItemIndex}
      components={{ Scroller }}
    />
  )
})

VirtualScroller.displayName = 'VirtualScroller'

export default VirtualScroller


