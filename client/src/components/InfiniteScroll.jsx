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

  // Intersection callback for viewport tracking (stable)
  const handleIntersection = useCallback((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = parseInt(entry.target.dataset.index) || 0
        currentIndexRef.current = index
        onScrollRef.current?.(null, index + 1) // Report 1-based index
      }
    })
  }, []) // No dependencies - stable callback

  // Set up intersection observer on all children
  useEffect(() => {
    const container = containerRef.current
    // eslint-disable-next-line no-console
    console.log('🔍 IS setup: 111')
    if (!container) return

    const observer = new IntersectionObserver(handleIntersection, {
      root: container,
      threshold: 0.5 // Element is "current" when 50% visible
    })

    // Observe all direct children
    const childElements = Array.from(container.children)
    childElements.forEach((child, idx) => {
      child.dataset.index = idx.toString()
      observer.observe(child)
    })
    
    return () => observer.disconnect()
  }, [children, handleIntersection]) // Add missing dependency

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