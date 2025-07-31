import { useState, useRef, useEffect } from 'react'
import { 
  Box, 
  Modal,
  Stack,
  Typography,
  IconButton
} from '@mui/joy'
import { Close, DragHandle } from '@mui/icons-material'
import { log } from '../utils/logger'

// Configurable drawer with swipe gestures, positioning, and height options
export const ActionDrawer = ({ 
  open, 
  onClose, 
  size = 'half', // 'half' | 'full' | 'fit-content'
  position = 'bottom', // 'top' | 'bottom'
  content,
  children 
}) => {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const drawerRef = useRef(null)
  const startY = useRef(0)

  // Calculate height based on size prop
  const getHeight = () => {
    switch (size) {
      case 'full': return '90vh'
      case 'half': return '50vh'
      case 'fit-content': return 'auto'
      default: return '50vh'
    }
  }

  // Handle touch/mouse start
  const handleDragStart = (e) => {
    setIsDragging(true)
    startY.current = e.touches ? e.touches[0].clientY : e.clientY
    setDragY(0)
  }

  // Handle touch/mouse move
  const handleDragMove = (e) => {
    if (!isDragging) return
    
    const currentY = e.touches ? e.touches[0].clientY : e.clientY
    const deltaY = currentY - startY.current
    
    // Allow appropriate drag direction based on position
    if (position === 'bottom' && deltaY > 0) {
      setDragY(deltaY) // Downward drag for bottom drawer
    } else if (position === 'top' && deltaY < 0) {
      setDragY(Math.abs(deltaY)) // Upward drag for top drawer
    }
  }

  // Handle touch/mouse end
  const handleDragEnd = () => {
    if (!isDragging) return
    
    setIsDragging(false)
    
    // Close if dragged down more than 100px
    if (dragY > 100) {
      onClose()
    }
    
    setDragY(0)
  }

  // Handle click outside to close
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Auto-hide on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: position === 'top' ? 'flex-start' : 'flex-end',
        justifyContent: 'center',
        zIndex: 1300
      }}
    >
      <Box
        onClick={handleBackdropClick}
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: position === 'top' ? 'flex-start' : 'flex-end',
          justifyContent: 'center',
          pt: position === 'top' ? 2 : 0,
          pb: position === 'bottom' ? 2 : 0
        }}
      >
        <Box
          ref={drawerRef}
          sx={{
            bgcolor: 'background.body',
            borderTopLeftRadius: position === 'bottom' ? 'lg' : 0,
            borderTopRightRadius: position === 'bottom' ? 'lg' : 0,
            borderBottomLeftRadius: position === 'top' ? 'lg' : 0,
            borderBottomRightRadius: position === 'top' ? 'lg' : 0,
            width: '100%',
            maxWidth: '500px',
            height: getHeight(),
            maxHeight: '90vh',
            transform: position === 'bottom' 
              ? `translateY(${dragY}px)` 
              : `translateY(${-dragY}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
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
          {/* Drag Handle - position based */}
          {position === 'bottom' && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 1,
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' }
              }}
            >
              <DragHandle sx={{ color: 'neutral.400' }} />
            </Box>
          )}

          {/* Header with close button */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, py: 1, borderBottom: position === 'top' ? 0 : 1, borderTop: position === 'top' ? 1 : 0, borderColor: 'divider' }}
          >
            <Typography level="h4">Tools</Typography>
            <IconButton
              size="sm"
              variant="plain"
              onClick={onClose}
              sx={{ color: 'neutral.500' }}
            >
              <Close />
            </IconButton>
          </Stack>

          {/* Drag Handle for top position */}
          {position === 'top' && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 1,
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' }
              }}
            >
              <DragHandle sx={{ color: 'neutral.400' }} />
            </Box>
          )}

          {/* Content */}
          <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
            {content || children || (
              <Stack spacing={2}>
                <Typography>Word Lists</Typography>
                <Typography>Settings</Typography>
                <Typography>Progress</Typography>
                <Typography>Additional Tools</Typography>
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
    </Modal>
  )
}