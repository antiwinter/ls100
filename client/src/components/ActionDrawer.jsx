import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, Stack, Typography, IconButton } from '@mui/joy'
import { Close } from '@mui/icons-material'
import { useDrag, useWheel } from '@use-gesture/react'
import { log } from '../utils/logger'

// Clamp a number to the inclusive range [a, b]
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

// Preset size configurations
const SIZES = {
  full: { h: '99vh', mh: '99vh' },
  half: { h: 'min(60vh, 300px)', mh: 'min(60vh, 300px)' },
  'fit-content': { h: 'auto', mh: '99vh' }
}

// Handle: visual-only page indicator
const Handle = ({ pos = 'bottom', pages = 0, page = 0 }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 0.75,
      pb: pos === 'bottom' ? 0 : 1.5,
      pt: pos === 'top' ? 0 : 1.5,
      pointerEvents: 'none'
    }}
  >
    <Stack direction='row' spacing={0.75} alignItems='center'>
      {Array.from({ length: Math.max(pages, 1) }).map((_, i) => (
        <Box
          key={i}
          sx={{
            height: '6px',
            width: i === page ? '20px' : '6px',
            borderRadius: '999px',
            bgcolor: i === page ? 'neutral.400' : 'neutral.300',
            transition: 'all 0.2s ease'
          }}
        />
      ))}
    </Stack>
  </Box>
)

// ActionDrawer: lite version with unified gesture handling
export const ActionDrawer = ({
  open,
  onClose = () => {},
  size = 'half',
  position = 'bottom',
  title,
  pages = [],
  initialPage = 0,
  onPageChange
}) => {
  // Return nothing if no pages
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return null
  }

  // Normalize pages to objects
  const list = pages.map(p => (p && typeof p === 'object' && 'content' in p) ? p : { content: p })
  
  const [page, setPage] = useState(clamp(initialPage, 0, Math.max(0, list.length - 1)))
  const [dragY, setDragY] = useState(0)
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)
  
  const drawRef = useRef(null)
  const slideRef = useRef(null)
  const pageRef = useRef(page)
  
  const bottom = position === 'bottom'
  const sz = SIZES[size] || SIZES.half

  // Update page in parent when changed
  const changePage = (newPage) => {
    const p = clamp(newPage, 0, list.length - 1)
    pageRef.current = p
    setPage(p)
    onPageChange?.(p)
  }

  // Shared close animation logic
  const animateOut = useCallback(() => {
    setShown(false)
    setTimeout(() => setRender(false), 300)
  }, [])

  // Internal close handler
  const handleClose = useCallback(() => {
    animateOut()
    setTimeout(() => onClose(), 300) // Wait for animation
  }, [animateOut, onClose])

  // Snap to page with animation
  const snap = (idx = pageRef.current) => {
    if (slideRef.current) {
      const w = slideRef.current.parentElement?.clientWidth || 1
      slideRef.current.style.transition = 'transform 0.25s ease'
      slideRef.current.style.transform = `translateX(${-idx * w}px)`
    }
  }

  // Unified drag gesture handler
  const bind = useDrag(
    ({ movement: [mx, my], dragging, last, velocity: [vx, vy], direction: [dx, dy] }) => {
      const axisThreshold = 20
      const isHorizontal = Math.abs(mx) > axisThreshold && Math.abs(mx) > Math.abs(my)
      const isVertical = Math.abs(my) > axisThreshold && Math.abs(my) > Math.abs(mx)

      if (isHorizontal) {
        // Horizontal drag for page navigation
        if (dragging && slideRef.current) {
          const w = slideRef.current.parentElement?.clientWidth || 1
          const offset = -page * w + mx
          slideRef.current.style.transition = 'none'
          slideRef.current.style.transform = `translateX(${offset}px)`
        }
        
        if (last) {
          const threshold = 80
          let newPage = page
          if (mx > threshold && page > 0) newPage = page - 1
          else if (mx < -threshold && page < list.length - 1) newPage = page + 1
          
          changePage(newPage)
          snap(newPage)
        }
      } else if (isVertical) {
        // Vertical drag for drawer close
        const forward = (bottom && my > 0) || (!bottom && my < 0)
        if (dragging && forward) {
          setDragY(Math.abs(my))
        }
        
        if (last) {
          if (Math.abs(my) > 100 && forward) {
            handleClose()
          }
          setDragY(0)
        }
      }
    },
    {
      axis: undefined, // Allow both axes
      filterTaps: true,
      preventScrollAxis: 'xy'
    }
  )

  // Wheel gesture for shift+wheel page navigation
  const wheelBind = useWheel(
    ({ event, delta: [dx, dy] }) => {
      if (event.shiftKey) {
        // Shift+wheel for page navigation
        event.preventDefault()
        const threshold = 50
        if (Math.abs(dx) > threshold) {
          let newPage = page
          if (dx > 0 && page < list.length - 1) newPage = page + 1
          else if (dx < 0 && page > 0) newPage = page - 1
          
          if (newPage !== page) {
            changePage(newPage)
            snap(newPage)
          }
        }
      }
      // Regular wheel events pass through for content scrolling
    },
    {
      preventScrollAxis: 'xy'
    }
  )

  // Handle external open/close
  useEffect(() => {
    if (open) {
      // External open: render true -> delay -> shown true (animate in)
      setRender(true)
      setShown(false)
      const timer = setTimeout(() => setShown(true), 20)
      return () => clearTimeout(timer)
    } else {
      // External close: shown false (animate out) -> delay -> render false
      animateOut()
    }
  }, [open, animateOut])

  // Snap to page when opened
  useEffect(() => {
    if (open && list.length > 0) {
      setTimeout(() => snap(page), 100)
    }
  }, [open, list.length])

  // Update internal page ref
  useEffect(() => {
    pageRef.current = page
  }, [page])

  // Keyboard support
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && open && handleClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  // Only render based on render state (single source of truth)
  if (!render) return null

  // Compute transform for vertical position
  const transform = () => {
    if (!shown) return `translateY(${bottom ? '100%' : '-100%'})`
    return `translateY(${bottom ? dragY : -dragY}px)`
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: bottom ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
        p: 0,
        pointerEvents: 'none',
        zIndex: 1300
      }}
    >
      <Box
        ref={drawRef}
        {...bind()}
        {...wheelBind()}
        onClick={e => e.stopPropagation()}
        sx={{
          bgcolor: 'background.body',
          pointerEvents: 'auto',
          borderRadius: bottom ? '24px 24px 0 0' : '0 0 24px 24px',
          width: 'calc(100% - 8px)',
          maxWidth: '500px',
          height: sz.h,
          maxHeight: sz.mh,
          transform: transform(),
          transition: 'transform 0.3s ease',
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
          touchAction: 'none'
        }}
      >
        {bottom && <Handle pos='bottom' pages={list.length} page={page} />}
        
        {title && (
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            sx={{ px: 2, py: 1, borderBottom: bottom ? 1 : 0, borderTop: bottom ? 0 : 1, borderColor: 'divider' }}
          >
            <Typography level='h4'>{title}</Typography>
            <IconButton size='sm' variant='plain' onClick={handleClose} sx={{ color: 'neutral.500' }}>
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
              minWidth: '100%'
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
                  touchAction: 'pan-y'
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
        
        {!bottom && <Handle pos='top' pages={list.length} page={page} />}
      </Box>
    </Box>
  )
}