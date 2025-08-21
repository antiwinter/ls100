import React, { forwardRef, useImperativeHandle, useRef, useMemo, useCallback, useEffect } from 'react'
import { Virtuoso } from 'react-virtuoso'

// A custom Item component that connects to an IntersectionObserver
const ObserverItem = ({ observer, children, ...props }) => {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el) {
      observer.observe(el)
      return () => observer.unobserve(el)
    }
  }, [observer])

  return <div ref={ref} {...props}>{children}</div>
}

// Generic virtual scroller built on react-virtuoso
// This version uses a robust IntersectionObserver pattern to find the top-most visible item.
export const VirtualScroller = forwardRef(({
  totalCount = 0,
  itemContent,
  itemKey,
  onRangeChange,
  onStartReached,
  onEndReached,
  increaseViewportBy,
  onScroll: _onScroll,
  className,
  style,
  initialTopMostItemIndex,
  topItemIndex
}, ref) => {
  const vRef = useRef(null)
  const observerRef = useRef(null)
  const topIndexRef = useRef(null)

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, align = 'start') => {
      vRef.current?.scrollToIndex({ index, align })
    },
    scrollTo: (opts) => {
      vRef.current?.scrollTo(opts)
    },
    reanchorTo: (index) => {
      if (!Number.isFinite(index)) return
      vRef.current?.scrollToIndex({ index, align: 'start' })
    }
  }), [])

  // Create the observer only once
  useEffect(() => {
    if (!topItemIndex || observerRef.current) return

    observerRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.dataset.index, 10)
          // To avoid rapid-fire updates, we only update if the index has changed
          if (!isNaN(index) && topIndexRef.current !== index) {
            topIndexRef.current = index
            topItemIndex(index)
          }
        }
      }
    }, {
      root: vRef.current?.root, // Observe within the scroller element
      rootMargin: '0px 0px -100%', // Find the item that first touches the top edge
      threshold: 0
    })

    return () => observerRef.current?.disconnect()
  }, [topItemIndex])


  // Memoize the components passed to Virtuoso
  const components = useMemo(() => {
    if (!observerRef.current) {
      return {}
    }
    return {
      Item: ({ children, ...props }) => <ObserverItem {...props} observer={observerRef.current}>{children}</ObserverItem>
    }
  }, [])


  // Memoized item content to prevent recreating the function on every render
  const itemContentMemo = useCallback((index) => (
    <div data-index={index}>
      {itemContent?.({ index })}
    </div>
  ), [itemContent])

  return (
    <Virtuoso
      ref={vRef}
      totalCount={totalCount}
      computeItemKey={itemKey}
      itemContent={itemContentMemo}
      rangeChanged={onRangeChange}
      startReached={onStartReached}
      endReached={onEndReached}
      increaseViewportBy={increaseViewportBy}
      initialTopMostItemIndex={initialTopMostItemIndex}
      components={components}
      // Pass through style and className to the root element
      style={style}
      className={className}
      // Virtuoso does not have a direct onScroll prop, it's handled by the scroller component
      // If onScroll is needed, a custom Scroller component would still be required,
      // but the observer logic should remain in the Item component.
    />
  )
})

VirtualScroller.displayName = 'VirtualScroller'

export default VirtualScroller
