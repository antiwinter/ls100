import { useState, useRef, useEffect } from 'react'
import { Box, Stack, Typography, IconButton } from '@mui/joy'
import { Close } from '@mui/icons-material'

// iOS-style drag handle with rounded rectangle bars - drag events only on handle
const Handle = ({ onDragStart, onDragMove, onDragEnd, position = 'bottom' }) => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    // Remove padding on side adjacent to content
    pb: position === 'bottom' ? 0 : 1.5, // Bottom drawer: handle at top, remove top padding (adjacent to content)
    pt: position === 'top' ? 0 : 1.5,    // Top drawer: handle at bottom, remove bottom padding (adjacent to content)
    cursor: 'grab',
    touchAction: 'none', // Prevent browser gestures on handle
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
    <Box sx={{
      width: '36px',
      height: '5px',
      bgcolor: 'neutral.300',
      borderRadius: '3px'
    }} />
  </Box>
)

export const ActionDrawer = ({ 
  open, 
  onClose, 
  size = 'half', 
  position = 'bottom',
  title,
  content,
  children 
}) => {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const [displayPosition, setDisplayPosition] = useState(position)
  const [isPositionChanging, setIsPositionChanging] = useState(false)
  const drawerRef = useRef(null)
  const startY = useRef(0)

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
      p: 0.5,
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
          borderRadius: '24px',
          width: '100%',
          maxWidth: '500px',
          height: heights[size] || heights.half,
          maxHeight: maxHeights[size] || maxHeights.half,
          transform: getTransform(),
          transition: isDragging 
            ? 'none' 
            : !open
              ? 'transform 0.4s ease-out'  // Smooth exit, no bounce
              : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy enter
          boxShadow: isBottom 
            ? '0 -8px 32px rgba(0, 0, 0, 0.12), 0 -4px 16px rgba(0, 0, 0, 0.08)' // Shadow above for bottom drawer
            : '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)',   // Shadow below for top drawer
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {isBottom && <Handle onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} position='bottom' />}
        
        {title && (
          <Stack direction='row' justifyContent='space-between' alignItems='center' 
                 sx={{ px: 2, py: 1, borderBottom: isBottom ? 1 : 0, borderTop: isBottom ? 0 : 1, borderColor: 'divider' }}>
            <Typography level='h4'>{title}</Typography>
            <IconButton size='sm' variant='plain' onClick={onClose} sx={{ color: 'neutral.500' }}>
              <Close />
            </IconButton>
          </Stack>
        )}

        <Box sx={{ 
          flex: 1, 
          p: 2,
          // Content provider handles overflow - this is just a container
          overflow: 'hidden'
        }}>
          {content || children}
        </Box>

        {!isBottom && <Handle onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} position='top' />}
      </Box>
    </Box>
  )
}