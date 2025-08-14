import React, { useEffect, useRef, useCallback } from 'react'
import { Box, CircularProgress } from '@mui/joy'

/**
 * Pure intersection-based infinite scroll detector
 * Observes anchor elements provided by parent
 */
export const InfiniteScroll = ({
  children,
  loading = false,
  loader = null,
  onScroll
}) => {
  const containerRef = useRef(null)
  const currentIndexRef = useRef(0)

  // Store onScroll in ref to avoid dependency issues
  const onScrollRef = useRef(onScroll)
  onScrollRef.current = onScroll

  // Intersection callback for top-band tracking (stable)
  // Band is very thin; grab the first intersecting entry and bail
  const handleIntersection = useCallback((entries) => {
    const first = entries.find(e => e.isIntersecting)
    if (!first) return
    const idx = parseInt(first.target.dataset.index) || 0
    if (currentIndexRef.current !== idx) {
      currentIndexRef.current = idx
      onScrollRef.current?.(null, idx + 1)
    }
  }, []) // No dependencies - stable callback

  // Set up intersection observer on all children (re-run only when child count changes)
  const childCount = React.Children.count(children)
  useEffect(() => {
    const container = containerRef.current
    // this log is crucial, never remove it
    // eslint-disable-next-line no-console
    console.log('🔍 IS setup: 111')
    if (!container) return

    const observer = new IntersectionObserver(handleIntersection, {
      root: container,
      // Thin band at the very top: any element touching the band becomes current
      // threshold 0 so any intersection counts; rootMargin shrinks viewport to ~1% height at the top
      threshold: 0,
      rootMargin: '0px 0px -99% 0px'
    })

    // Observe all direct children
    const childElements = Array.from(container.children)
    childElements.forEach((child, idx) => {
      child.dataset.index = idx.toString()
      observer.observe(child)
    })

    return () => observer.disconnect()
  }, [childCount, handleIntersection])

  // Simple scroll handler for toolbar hiding
  const handleScroll = (e) => {
    onScroll?.(e)
  }

  return (
    <Box
      ref={containerRef}
      data-scroll-container="true"
      onScroll={handleScroll}
      sx={{
        flex: 1,
        maxHeight: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        px: 1,
        py: 1,
        // Hide scrollbar but keep scrolling
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE
        '&::-webkit-scrollbar': {
          display: 'none' // Webkit browsers
        }
      }}
    >
      {children}

      {/* Loading indicator */}
      {loading && (
        loader || (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size="sm" />
          </Box>
        )
      )}
    </Box>
  )
}

export default InfiniteScroll
