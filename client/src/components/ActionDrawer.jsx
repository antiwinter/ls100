import { useState, useRef, useEffect,
  useCallback, forwardRef, useImperativeHandle,
  useMemo, memo } from 'react'
import { Box, Stack, Typography, IconButton } from '@mui/joy'
import { Close } from '@mui/icons-material'
import { log } from '../utils/logger'

const ANIMATION = 300

// Helper to prevent all pointer events from bubbling
const stopAllEvents = () => {
  const res = {}
  ;['onPointerDown', 'onPointerMove',
    'onPointerUp', 'onTouchStart',
    'onTouchMove', 'onTouchEnd',
    'onMouseDown', 'onMouseMove',
    'onMouseUp', 'onClick', 'onWheel']
    .forEach(k => {
      res[k] = (e) => {
        // log.info('stopped Events', k, e)
        e.stopPropagation()
      }
    })
  return res
}

// Preset size configurations
const SIZES = {
  full: { h: '99vh', mh: '99vh' },
  half: { h: 'min(60vh, 300px)', mh: 'min(60vh, 300px)' },
  'fit-content': { h: 'auto', mh: '99vh' }
}

// Indicator: page indicator with imperative control
const Indicator = memo(forwardRef(({ pos = 'bottom', pages = 0, page = 0, onChange }, ref) => {
  const [currentPage, setCurrentPage] = useState(page)

  log.info('Indicator re-render', { pos, pages, page, onChange })
  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    setPage: (newPage) => {
      setCurrentPage(newPage)
    }
  }), [])

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0.75,
        pb: pos === 'bottom' ? 0 : 1.5,
        pt: pos === 'top' ? 0 : 1.5
      }}
    >
      <Stack direction='row' spacing={0.75} alignItems='center'>
        {Array.from({ length: Math.max(pages, 1) }).map((_, i) => (
          <Box
            key={i}
            onClick={() => onChange?.(i)}
            sx={{
              height: '6px',
              width: i === currentPage ? '20px' : '6px',
              borderRadius: '999px',
              bgcolor: i === currentPage ? 'neutral.400' : 'neutral.300',
              transition: 'all 0.2s ease',
              cursor: onChange ? 'pointer' : 'default'
            }}
          />
        ))}
      </Stack>
    </Box>
  )
}))

// ActionDrawer: lite version with unified gesture handling and imperative API
export const ActionDrawer = forwardRef(({
  size = 'half',
  position = 'bottom',
  title,
  onPageChange
}, ref) => {
  // Internal state for pages and visibility
  const [pages, setPages] = useState([])
  const [page, setPage] = useState(0)
  const [shown, setShown] = useState(false)

  // Memoize pages normalization to prevent recreation on every render
  const list = useMemo(() => {
    return pages && Array.isArray(pages)
      ? pages.map(p => (p && typeof p === 'object' && 'content' in p) ? p : { content: p })
      : []
  }, [pages])

  log.warn('ActionDrawer re-render', { title, pages: pages.length, shown })
  const drawRef = useRef(null)
  const slideRef = useRef(null)
  const pageRef = useRef(page)
  const bottomIndicatorRef = useRef(null)
  const topIndicatorRef = useRef(null)
  const closeTimeoutRef = useRef(null)

  const bottom = position === 'bottom'
  const sz = SIZES[size] || SIZES.half

  // Snap to page with animation
  const snap = useCallback((idx = pageRef.current) => {
    if (slideRef.current) {
      const w = slideRef.current.parentElement?.clientWidth || 1
      slideRef.current.style.transition = 'transform 0.25s ease'
      slideRef.current.style.transform = `translateX(${-idx * w}px)`
    }
  }, [])

  // Update page in parent when changed
  const handleIndicatorChange = useCallback((newPage) => {
    const p = Math.max(0, Math.min(list.length - 1, newPage))
    pageRef.current = p
    setPage(p)
    onPageChange?.(p)
    // Update indicators
    bottomIndicatorRef.current?.setPage(p)
    topIndicatorRef.current?.setPage(p)
    setTimeout(() => snap(p), 50)
  }, [list.length, onPageChange, snap])

  // Shared close logic
  const doClose = useCallback(() => {
    setShown(false)
    closeTimeoutRef.current = setTimeout(() => {
      setPages([])
      setPage(0)
      pageRef.current = 0
      closeTimeoutRef.current = null
    }, ANIMATION)
  }, [])

  // Imperative API
  useImperativeHandle(ref, () => ({
    open: (newPages) => {
      log.debug('ActionDrawer.open', { pages: newPages?.length })
      // Cancel any ongoing close timeout
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setPages(newPages || [])
      setPage(0)
      pageRef.current = 0

      // setShown(false)
      setTimeout(() => setShown(true), 20)
    },
    close: () => {
      log.debug('ActionDrawer.close')
      doClose()
    },
    nav: (newPage) => {
      log.debug('ActionDrawer.nav', { page: newPage })
      const p = Math.max(0, Math.min(list.length - 1, newPage))
      pageRef.current = p
      setPage(p)
      onPageChange?.(p)
      bottomIndicatorRef.current?.setPage(p)
      topIndicatorRef.current?.setPage(p)
      setTimeout(() => snap(p), 50)
    }
  }), [list.length, onPageChange, snap, doClose])


  // Snap to page when pages change
  useEffect(() => {
    if (list.length > 0 && shown) {
      setTimeout(() => snap(), 100)
    }
  }, [list.length, shown, snap])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Return nothing if no pages (after hooks)
  if (!pages || pages?.length === 0) {
    return null
  }

  // Compute transform for vertical position
  const transform = () => {
    if (!shown) return `translateY(${bottom ? '100%' : '-100%'})`
    return 'translateY(0px)'
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        [bottom ? 'bottom' : 'top']: 0,
        display: 'flex',
        justifyContent: 'center',
        p: 0,
        zIndex: 1300,
        pointerEvents: 'none' // Allow clicks to pass through to content below
      }}
    >
      <Box
        ref={drawRef}
        {...stopAllEvents()}
        sx={{
          bgcolor: 'background.body',
          pointerEvents: 'auto', // Drawer content should receive clicks
          borderRadius: bottom ? '24px 24px 0 0' : '0 0 24px 24px',
          width: 'calc(100% - 8px)',
          maxWidth: '500px',
          height: sz.h,
          maxHeight: sz.mh,
          transform: transform(),
          transition: `transform ${ANIMATION / 1000}s ease`,
          boxShadow: t => (
            t.palette.mode === 'dark'
              ? '0 0 0 1px rgba(255,255,255,0.2), 0 0 10px rgba(159,248,217,0.7), 0 0 20px rgba(59,246,93,0.15)'
              : (
                bottom
                  ? '0 -8px 32px rgba(0,0,0,0.12), 0 -4px 16px rgba(0,0,0,0.08)'
                  : '0 8px 32px rgba(210, 71, 71, 0.12), 0 4px 16px rgba(0,0,0,0.08)'
              )
          ),
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overscrollBehavior: 'contain' // Prevent scroll chaining at root level
        }}
      >
        {bottom && <Indicator ref={bottomIndicatorRef} pos='bottom' pages={list.length} page={page} onChange={handleIndicatorChange} />}

        {title && (
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            sx={{ px: 2, py: 1, borderBottom: bottom ? 1 : 0, borderTop: bottom ? 0 : 1, borderColor: 'divider' }}
          >
            <Typography level='h4'>{title}</Typography>
            <IconButton size='sm' variant='plain' onClick={doClose} sx={{ color: 'neutral.500' }}>
              <Close />
            </IconButton>
          </Stack>
        )}

        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <Box
            ref={slideRef}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'row',
              width: '100%',
              willChange: 'transform',
              minWidth: '100%',
              overscrollBehavior: 'contain' // Prevent any scroll chaining
            }}
          >
            {list.map((p, i) => (
              <Box
                key={p.key ?? i}
                sx={{
                  flex: '0 0 100%',
                  height: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  overscrollBehavior: 'contain', // Prevent scroll chaining
                  WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
                }}
              >
                <Box sx={{ p: 2, minHeight: '100%' }}>
                  {p.title && (
                    <Typography level='title-sm' sx={{ mb: 1, color: 'neutral.500' }}>
                      {p.title}
                    </Typography>
                  )}
                  {p.content ?? p}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {!bottom && <Indicator ref={topIndicatorRef} pos='top' pages={list.length} page={page} onChange={handleIndicatorChange} />}
      </Box>
    </Box>
  )
})

ActionDrawer.displayName = 'ActionDrawer'
