import { useState, useRef, useEffect } from 'react'
import { 
  Box, 
  Modal,
  Stack,
  Typography,
  IconButton
} from '@mui/joy'
import { Close, DragHandle } from '@mui/icons-material'
import { log } from '../../../utils/logger'

// Bottom slide-up drawer with swipe gestures and configurable height
export const ActionDrawer = ({ 
  open, 
  onClose, 
  size = 'half', // 'half' | 'full' | 'fit-content'
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
    
    // Only allow downward drag
    if (deltaY > 0) {
      setDragY(deltaY)
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
        alignItems: 'flex-end',
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
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}
      >
        <Box
          ref={drawerRef}
          sx={{
            bgcolor: 'background.body',
            borderTopLeftRadius: 'lg',
            borderTopRightRadius: 'lg',
            width: '100%',
            maxWidth: '500px',
            height: getHeight(),
            maxHeight: '90vh',
            transform: `translateY(${dragY}px)`,
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
          {/* Drag Handle */}
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

          {/* Header with close button */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}
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