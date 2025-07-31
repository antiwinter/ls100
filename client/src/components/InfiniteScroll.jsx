import { useEffect, useRef, useCallback } from 'react'
import { Box, CircularProgress, Typography } from '@mui/joy'
import { log } from '../utils/logger'

/**
 * Reusable infinite scroll component using Intersection Observer API
 * Based on: https://blog.logrocket.com/react-infinite-scroll/
 */
export const InfiniteScroll = ({
  children,
  onLoadMore,
  hasMore = true,
  loading = false,
  loader = null,
  endMessage = null,
  rootMargin = '100px',
  threshold = 0.1
}) => {
  const observerRef = useRef(null)
  const triggerRef = useRef(null)

  // Intersection Observer callback
  const handleIntersection = useCallback((entries) => {
    const [entry] = entries
    
    if (entry.isIntersecting && hasMore && !loading && onLoadMore) {
      log.debug('Infinite scroll triggered - loading more content')
      onLoadMore()
    }
  }, [hasMore, loading, onLoadMore])

  // Set up Intersection Observer
  useEffect(() => {
    const trigger = triggerRef.current
    
    if (!trigger) return

    const options = {
      root: null, // Use viewport as root
      rootMargin,
      threshold
    }

    observerRef.current = new IntersectionObserver(handleIntersection, options)
    observerRef.current.observe(trigger)

    return () => {
      if (observerRef.current && trigger) {
        observerRef.current.unobserve(trigger)
        observerRef.current.disconnect()
      }
    }
  }, [handleIntersection, rootMargin, threshold])

  // Default loader component
  const defaultLoader = (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
      <CircularProgress size="sm" />
    </Box>
  )

  // Default end message
  const defaultEndMessage = (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Typography level="body-sm" color="neutral">
        No more content to load
      </Typography>
    </Box>
  )

  return (
    <Box>
      {/* Main content */}
      {children}
      
      {/* Intersection trigger element */}
      {hasMore && (
        <div 
          ref={triggerRef}
          style={{ 
            height: '1px', 
            width: '100%',
            position: 'relative'
          }}
        />
      )}
      
      {/* Loading indicator */}
      {loading && (loader || defaultLoader)}
      
      {/* End message when no more content */}
      {!hasMore && !loading && (endMessage || defaultEndMessage)}
    </Box>
  )
}

export default InfiniteScroll