import React, { forwardRef, useImperativeHandle, useRef, useMemo, useCallback, useEffect } from 'react'
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
  initialTopMostItemIndex,
  topItemIndex
}, ref) => {
  const vRef = useRef(null)
  const observerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, align = 'start') => {
      vRef.current?.scrollToIndex({ index, align })
    },
    scrollTo: (opts) => {
      vRef.current?.scrollTo(opts)
    }
  }), [])

  // Create observer immediately when topItemIndex is available
  if (topItemIndex && !observerRef.current) {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.dataset.index, 10)
          if (!isNaN(index)) topItemIndex(index)
        }
      })
    }, {
      rootMargin: '0px 0px -90% 0px',
      threshold: 0.1
    })
  }

  // Cleanup observer when topItemIndex is removed
  useEffect(() => {
    if (!topItemIndex && observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
  }, [topItemIndex])

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

      // Observe items and handle initial state
      useEffect(() => {
        if (!sRef.current || !topItemIndex) return

        const scrollerEl = sRef.current

        if (!observerRef.current) return

        const observer = observerRef.current
        const checkInitial = () => {
          const items = scrollerEl.querySelectorAll('[data-index]')
          const threshold = window.innerHeight * 0.1

          for (let item of items) {
            const rect = item.getBoundingClientRect()
            if (rect.top >= 0 && rect.top <= threshold) {
              const index = parseInt(item.dataset.index, 10)
              if (!isNaN(index)) return topItemIndex(index)
            }
          }
        }

        const mutationObserver = new MutationObserver(() => {
          scrollerEl.querySelectorAll('[data-index]').forEach(item => observer.observe(item))
          checkInitial()
        })

        mutationObserver.observe(scrollerEl, { childList: true, subtree: true })
        scrollerEl.querySelectorAll('[data-index]').forEach(item => observer.observe(item))
        checkInitial()

        return () => {
          mutationObserver.disconnect()
          scrollerEl.querySelectorAll('[data-index]').forEach(item => observer.unobserve(item))
        }
      })

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
  }, [onScroll, className, style, topItemIndex])

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


