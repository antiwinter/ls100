import React, { useEffect, useRef, useCallback } from 'react'
import { Box, CircularProgress, Typography } from '@mui/joy'
import { log } from '../utils/logger'

/**
 * Pure intersection-based infinite scroll detector
 * Observes anchor elements provided by parent
 */
export const InfiniteScroll = ({
  children,
  onLoadMore,
  loading = false,
  loader = null,
  anchors = []  // Array of elements to observe
}) => {
  const containerRef = useRef(null)
  
  const DEBUG_INTERSECTION = true

  // Intersection callback  
  const handleIntersection = useCallback((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || loading || !onLoadMore) return
      
      log.debug('Intersection detected on element:', entry.target)
      onLoadMore(entry.target)  // Pass back the actual observed element
    })
  }, [loading, onLoadMore])

  // Set up intersection observers on anchor elements
  useEffect(() => {
    const container = containerRef.current
    log.debug(`🔍 IS setup: container=${!!container}, anchors=${anchors.length}`)
    
    if (!container || !anchors.length) return

    const observer = new IntersectionObserver(handleIntersection, {
      root: container,
      threshold: 0.1
    })

    // Debug styling and observe each anchor
    anchors.forEach((anchor, idx) => {
      if (anchor) {
        log.debug(`🔍 Observing anchor ${idx}:`, anchor.tagName)
        if (DEBUG_INTERSECTION) {
          anchor.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'
        }
        observer.observe(anchor)
      }
    })
    
    return () => {
      observer.disconnect()
      
      // Clean up debug styling
      if (DEBUG_INTERSECTION) {
        anchors.forEach(anchor => {
          if (anchor) {
            anchor.style.backgroundColor = ''
          }
        })
      }
    }
  }, [handleIntersection, anchors]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box 
      ref={containerRef}
      data-scroll-container="true"
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