import { useState, useRef, useEffect } from 'react'
import { Box, Stack, Typography, IconButton } from '@mui/joy'
import { Close } from '@mui/icons-material'

// iOS-style drag handle with rounded rectangle bars
const Handle = () => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    py: 1.5, 
    cursor: 'grab',
    '&:active': { cursor: 'grabbing' }
  }}>
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
  const heights = { full: '90vh', half: '50vh', 'fit-content': 'auto' }

  const handleDragStart = (e) => {
    setIsDragging(true)
    startY.current = e.touches ? e.touches[0].clientY : e.clientY
    setDragY(0)
  }

  const handleDragMove = (e) => {
    if (!isDragging) return
    const currentY = e.touches ? e.touches[0].clientY : e.clientY
    const deltaY = currentY - startY.current
    
    if ((isBottom && deltaY > 0) || (!isBottom && deltaY < 0)) {
      setDragY(Math.abs(deltaY))
    }
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragY > 100) onClose()
    setDragY(0)
  }

  // Manage rendering and entry animation
  useEffect(() => {
    if (open) {
      // Set correct position immediately when opening
      setDisplayPosition(position)
      setShouldRender(true)
      setIsEntering(true)
      // Start enter animation after brief delay
      const timer = setTimeout(() => setIsEntering(false), 50)
      return () => clearTimeout(timer)
    } else {
      setIsEntering(false)
      // Keep rendered during exit animation, then hide
      const timer = setTimeout(() => setShouldRender(false), 500)
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
    
    if (isEntering || !open) {
      // Start off-screen for enter animation, or slide off-screen for exit
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
      p: 2,
      pointerEvents: 'none', // Never block background clicks
      zIndex: 1300,
      transition: isPositionChanging 
        ? 'align-items 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' 
        : 'none'
    }}>
      <Box
        ref={drawerRef}
        sx={{
          bgcolor: 'background.body',
          pointerEvents: 'auto',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '500px',
          height: heights[size] || '50vh',
          maxHeight: '90vh',
          transform: getTransform(),
          transition: isDragging 
            ? 'none' 
            : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: 'lg',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
      >
        {isBottom && <Handle />}
        
        {title ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center" 
                 sx={{ px: 2, py: 1, borderBottom: isBottom ? 1 : 0, borderTop: isBottom ? 0 : 1, borderColor: 'divider' }}>
            <Typography level="h4">{title}</Typography>
            <IconButton size="sm" variant="plain" onClick={onClose} sx={{ color: 'neutral.500' }}>
              <Close />
            </IconButton>
          </Stack>
        ) : (
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
            <IconButton size="sm" variant="plain" onClick={onClose} sx={{ 
              color: 'neutral.500',
              bgcolor: 'background.surface',
              borderRadius: '50%',
              '&:hover': { bgcolor: 'neutral.100' }
            }}>
              <Close />
            </IconButton>
          </Box>
        )}

        {!isBottom && <Handle />}

        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          {content || children}
        </Box>
      </Box>
    </Box>
  )
}