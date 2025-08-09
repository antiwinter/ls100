import { useState, useRef, useEffect } from 'react'
import { Box, Stack, Typography, IconButton } from '@mui/joy'
import { Close } from '@mui/icons-material'
import { log } from '../utils/logger'

// Handle area doubles as page indicator; still captures vertical drag to close
const Handle = ({ 
  onDragStart, 
  onDragMove, 
  onDragEnd, 
  position = 'bottom',
  pageCount = 0,
  activePage = 0
}) => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 0.75,
    // Remove padding on side adjacent to content
    pb: position === 'bottom' ? 0 : 1.5,
    pt: position === 'top' ? 0 : 1.5,
    cursor: 'grab',
    touchAction: 'none',
    '&:active': { cursor: 'grabbing' }
  }}
    onTouchStart={(e) => {
      e.stopPropagation()
      onDragStart(e)
    }}
    onTouchMove={(e) => {
      e.stopPropagation()
      onDragMove(e)
    }}
    onTouchEnd={(e) => {
      e.stopPropagation()
      onDragEnd(e)
    }}
    onMouseDown={(e) => {
      e.stopPropagation()
      onDragStart(e)
    }}
    onMouseMove={(e) => {
      e.stopPropagation()
      onDragMove(e)
    }}
    onMouseUp={(e) => {
      e.stopPropagation()
      onDragEnd(e)
    }}
  >
    <Stack direction='row' spacing={0.75} alignItems='center' onClick={(e) => e.stopPropagation()}>
      {Array.from({ length: Math.max(pageCount, 1) }).map((_, idx) => (
        <Box key={idx}
          sx={{
            height: '6px',
            width: idx === activePage ? '20px' : '6px',
            borderRadius: '999px',
            bgcolor: idx === activePage ? 'neutral.400' : 'neutral.300',
            transition: 'all 0.2s ease'
          }}
        />
      ))}
    </Stack>
  </Box>
)

export const ActionDrawer = ({ 
  open, 
  onClose, 
  size = 'half', 
  position = 'bottom',
  title,
  pages,
  initialPage = 0,
  onPageChange
}) => {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const [displayPosition, setDisplayPosition] = useState(position)
  const [isPositionChanging, setIsPositionChanging] = useState(false)
  const drawerRef = useRef(null)
  const startY = useRef(0)
  const contentRef = useRef(null)

  // Horizontal paging state
  const normalizedPages = Array.isArray(pages) ? pages.map(p => {
    if (p && typeof p === 'object' && 'content' in p) return p
    return { content: p }
  }) : []
  const pageCount = normalizedPages.length
  const [activePage, setActivePage] = useState(() => {
    const idx = Math.max(0, Math.min(initialPage, Math.max(0, pageCount - 1)))
    return idx
  })
  const [isHDragging, setIsHDragging] = useState(false)
  const startX = useRef(0)
  const startYH = useRef(0)
  const hLockRef = useRef(null) // null=undecided, 'h'=horizontal, 'v'=vertical
  const isPagingEnabled = pageCount > 0
  const wheelCooldownRef = useRef(0)
  const sliderRef = useRef(null)
  const widthRef = useRef(0)
  const basePxRef = useRef(0)
  const dragXRef = useRef(0)

  const getPoint = (e) => ({
    x: e.touches?.[0]?.clientX ?? e.clientX,
    y: e.touches?.[0]?.clientY ?? e.clientY
  })

  const isBottom = displayPosition === 'bottom'
  const heights = { 
    full: '99vh', 
    half: 'min(60vh, 300px)', 
    'fit-content': 'auto' 
  }
  const maxHeights = {
    full: '99vh',
    half: 'min(60vh, 300px)', 
    'fit-content': '99vh'
  }

  const handleDragStart = (e) => {
    setIsDragging(true)
    startY.current = e.touches?.[0]?.clientY ?? e.clientY
    setDragY(0)
  }

  const handleDragMove = (e) => {
    if (!isDragging) return
    const y = e.touches?.[0]?.clientY ?? e.clientY
    const delta = y - startY.current
    
    if ((isBottom && delta > 0) || (!isBottom && delta < 0)) {
      setDragY(Math.abs(delta))
    }
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragY > 100) onClose()
    setDragY(0)
  }

  // Horizontal swipe handlers (content area)
  const handleHDragStartCapture = (e) => {
    if (!isPagingEnabled) return
    const { x, y } = getPoint(e)
    startX.current = x
    startYH.current = y
    hLockRef.current = null
    dragXRef.current = 0
    widthRef.current = contentRef.current?.clientWidth || 1
    basePxRef.current = -activePage * widthRef.current
    if (sliderRef.current) {
      sliderRef.current.style.transition = 'none'
    }
    // Do not stop here; decide on move
  }

  const handleHDragMoveCapture = (e) => {
    if (!isPagingEnabled) return
    const { x, y } = getPoint(e)
    const dx = x - startX.current
    const dy = y - startYH.current

    if (hLockRef.current == null) {
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax > 10 || ay > 10) {
        if (ax > ay * 1.2) {
          hLockRef.current = 'h'
          setIsHDragging(true)
          log.debug(`[ActionDrawer] lock horizontal dx=${dx} dy=${dy}`)
        } else {
          hLockRef.current = 'v'
          log.debug(`[ActionDrawer] lock vertical dx=${dx} dy=${dy}`)
        }
      }
    }

    if (hLockRef.current === 'h') {
      e.preventDefault?.()
      e.stopPropagation?.()
      dragXRef.current = dx
      if (sliderRef.current) {
        const px = basePxRef.current + dx
        sliderRef.current.style.transform = `translateX(${px}px)`
      }
    }
  }

  const handleHDragEndCapture = (e) => {
    if (!isPagingEnabled) return
    if (hLockRef.current === 'h') {
      e.preventDefault?.()
      e.stopPropagation?.()
      const threshold = 60
      const dx = dragXRef.current
      let next = activePage
      if (dx > threshold && activePage > 0) {
        const next = activePage - 1
        setActivePage(next)
        onPageChange?.(next)
      } else if (dx < -threshold && activePage < pageCount - 1) {
        const next = activePage + 1
        setActivePage(next)
        onPageChange?.(next)
      }
    }
    setIsHDragging(false)
    dragXRef.current = 0
    hLockRef.current = null
    // snap to active page
    const w = widthRef.current || contentRef.current?.clientWidth || 1
    if (sliderRef.current) {
      sliderRef.current.style.transition = 'transform 0.25s ease'
      sliderRef.current.style.transform = `translateX(${-activePage * w}px)`
    }
  }

  // Wheel-based navigation (trackpads)
  const handleWheelCapture = (e) => {
    if (!isPagingEnabled) return
    const now = Date.now()
    if (now - wheelCooldownRef.current < 400) return
    const ax = Math.abs(e.deltaX)
    const ay = Math.abs(e.deltaY)
    if (ax > ay + 5 && ax > 20) {
      e.stopPropagation()
      let next = activePage
      if (e.deltaX > 0 && activePage < pageCount - 1) next = activePage + 1
      if (e.deltaX < 0 && activePage > 0) next = activePage - 1
      if (next !== activePage) {
        wheelCooldownRef.current = now
        setActivePage(next)
        onPageChange?.(next)
        const w = contentRef.current?.clientWidth || 1
        if (sliderRef.current) {
          sliderRef.current.style.transition = 'transform 0.25s ease'
          sliderRef.current.style.transform = `translateX(${-next * w}px)`
        }
      }
    }
  }

  // Snap to active page whenever size changes or page changes (e.g., after open)
  useEffect(() => {
    if (!isPagingEnabled) return
    const snap = () => {
      const w = contentRef.current?.clientWidth || 1
      widthRef.current = w
      if (sliderRef.current) {
        sliderRef.current.style.transition = isHDragging ? 'none' : 'transform 0.25s ease'
        sliderRef.current.style.transform = `translateX(${-activePage * w}px)`
      }
    }
    snap()
    window.addEventListener('resize', snap)
    return () => window.removeEventListener('resize', snap)
  }, [activePage, isPagingEnabled, isHDragging, open])

  // Manage rendering state
  useEffect(() => {
    if (open) {
      setDisplayPosition(position)
      setShouldRender(true)
      setIsEntering(true)
      // Complete enter animation
      const timer = setTimeout(() => setIsEntering(false), 50)
      return () => clearTimeout(timer)
    } else {
      setIsEntering(false)
      // Keep rendered for exit animation
      const timer = setTimeout(() => setShouldRender(false), 400)
      return () => clearTimeout(timer)
    }
  }, [open, position])

  // Handle position changes while drawer is open
  useEffect(() => {
    if (position !== displayPosition && open && !isEntering) {
      setIsPositionChanging(true)
      // Change position immediately, then clear changing state after animation
      setDisplayPosition(position)
      const timer = setTimeout(() => {
        setIsPositionChanging(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [position, displayPosition, open, isEntering])

  useEffect(() => {
    const handleEscape = (e) => e.key === 'Escape' && open && onClose()
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!shouldRender) return null

  // Calculate transform based on state
  const getTransform = () => {
    if (isDragging) {
      return `translateY(${isBottom ? dragY : -dragY}px)`
    }
    
    if (isEntering) {
      // Start off-screen for enter animation
      return `translateY(${isBottom ? '100%' : '-100%'})`
    }
    
    if (!open) {
      // Exit to off-screen - CSS transition will handle smooth movement
      return `translateY(${isBottom ? '100%' : '-100%'})`
    }
    
    // Open and stable - normal position with any drag offset
    return `translateY(${isBottom ? dragY : -dragY}px)`
  }

  return (
    <Box sx={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: isBottom ? 'flex-end' : 'flex-start',
      justifyContent: 'center',
      p: 0,
      pointerEvents: 'none', // Never block background clicks
      zIndex: 1300,
      transition: isPositionChanging 
        ? 'align-items 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' 
        : 'none'
    }}>
      <Box
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()} // Block clicks from passing through
        sx={{
          bgcolor: 'background.body',
          pointerEvents: 'auto',
          borderRadius: isBottom ? '24px 24px 0 0' : '0 0 24px 24px',
          // Slightly narrower than viewport to reveal side borders
          width: 'calc(100% - 8px)',
          maxWidth: '500px',
          height: heights[size] || heights.half,
          maxHeight: maxHeights[size] || maxHeights.half,
          transform: getTransform(),
          transition: isDragging 
            ? 'none' 
            : !open
              ? 'transform 0.4s ease-out'  // Smooth exit
              : 'transform 0.3s ease-in', // Smooth enter
          boxShadow: (theme) => {
            if (theme.palette.mode === 'dark') {
              // Colored glow effect for dark mode - more visible
              return '0 0 0 1px rgba(255, 255, 255, 0.2), 0 0 10px rgba(159, 248, 217, 0.7), 0 0 20px rgba(59, 246, 93, 0.15)'
            } else {
              // Traditional shadows for light mode
              return isBottom 
                ? '0 -8px 32px rgba(0, 0, 0, 0.12), 0 -4px 16px rgba(0, 0, 0, 0.08)'
                : '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)'
            }
          },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {isBottom && (
          <Handle 
            onDragStart={handleDragStart} 
            onDragMove={handleDragMove} 
            onDragEnd={handleDragEnd} 
            position='bottom' 
            pageCount={pageCount}
            activePage={activePage}
          />
        )}
        
        {title && (
          <Stack direction='row' justifyContent='space-between' alignItems='center' 
                 sx={{ px: 2, py: 1, borderBottom: isBottom ? 1 : 0, borderTop: isBottom ? 0 : 1, borderColor: 'divider' }}>
            <Typography level='h4'>{title}</Typography>
            <IconButton size='sm' variant='plain' onClick={onClose} sx={{ color: 'neutral.500' }}>
              <Close />
            </IconButton>
          </Stack>
        )}

        <Box ref={contentRef} sx={{ 
          flex: 1, 
          p: 0,
          overflow: 'hidden',
          position: 'relative'
        }}
          onTouchStartCapture={handleHDragStartCapture}
          onTouchMoveCapture={handleHDragMoveCapture}
          onTouchEndCapture={handleHDragEndCapture}
          onWheelCapture={handleWheelCapture}
          onMouseDownCapture={(e) => {
            // Only start mouse-based swipe on primary button
            if (e.button !== 0) return
            handleHDragStartCapture(e)
          }}
          onMouseMoveCapture={handleHDragMoveCapture}
          onMouseUpCapture={handleHDragEndCapture}
        >
          {pageCount > 0 ? (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'row',
                width: '100%',
                transform: (() => {
                  const width = contentRef.current?.clientWidth || 1
                  const basePx = -activePage * width
                  const dragPx = isHDragging ? dragX : 0
                  return `translateX(${basePx + dragPx}px)`
                })(),
                transition: isHDragging ? 'none' : 'transform 0.25s ease',
                // Create own stacking/graphics layer so underlying content won't visually bleed
                willChange: 'transform',
                // Prevent contents from shrinking when text wraps
                minWidth: '100%'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {normalizedPages.map((p, idx) => (
                <Box key={p.key ?? idx}
                  sx={{
                    flex: '0 0 100%',
                    height: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    touchAction: 'pan-y', // allow vertical scrolling inside page
                    pr: 0.5 // minimal spacing to avoid scrollbar overlay
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Box sx={{ p: 2, boxSizing: 'border-box', minHeight: '100%' }}>
                    {p.title ? (
                      <Typography level='title-sm' sx={{ mb: 1, color: 'neutral.500' }}>{p.title}</Typography>
                    ) : null}
                    {p.content ?? p}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>

        {!isBottom && (
          <Handle 
            onDragStart={handleDragStart} 
            onDragMove={handleDragMove} 
            onDragEnd={handleDragEnd} 
            position='top' 
            pageCount={pageCount}
            activePage={activePage}
          />
        )}
      </Box>
    </Box>
  )
}