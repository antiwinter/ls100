import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Stack,
  IconButton,
  Typography
} from '@mui/joy'
import { 
  ArrowBack, 
  Edit,
  TextFields,
  Search
} from '@mui/icons-material'
import { log } from '../../../utils/logger'

// Top slide-down toolbar with auto-hide and tool buttons
export const Toolbar = ({ 
  visible, 
  onBack, 
  onToolSelect, 
  movieName 
}) => {
  const [isVisible, setIsVisible] = useState(visible)
  const hideTimer = useRef(null)

  // Sync internal state with visible prop - no auto-hide when controlled by parent
  useEffect(() => {
    log.debug(`🔧 Toolbar visibility prop changed: ${visible} -> setting isVisible to ${visible}`)
    setIsVisible(visible)
    
    // Clear any existing timer when visibility changes
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
    }
  }, [visible])

  // Handle tool selection
  const handleToolClick = (tool) => {
    log.debug('Tool selected:', tool)
    if (onToolSelect) {
      onToolSelect(tool)
    }
  }

  // Mouse handlers no longer needed since toolbar is controlled by parent
  const handleMouseEnter = () => {
    // No auto-hide behavior needed
  }

  const handleMouseLeave = () => {
    // No auto-hide behavior needed
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 150,
        bgcolor: 'background.body',
        py: 1,
        px: 2,
        borderBottom: isVisible ? 1 : 0,
        borderColor: 'divider',
        transform: isVisible ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 0.3s ease-out',
        boxShadow: isVisible ? 'sm' : 'none'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {/* Left side: Back button + movie name */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            onClick={onBack}
            variant="plain"
            size="sm"
            sx={{ 
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'neutral.100'
              }
            }}
          >
            <ArrowBack />
          </IconButton>
          
          <Typography 
            level="title-sm" 
            sx={{ 
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {movieName || 'Reader'}
          </Typography>
        </Stack>
        
        {/* Right side: Tool buttons */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            onClick={() => handleToolClick('word')}
            variant="plain"
            size="sm"
            sx={{ 
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'neutral.100'
              }
            }}
            title="Word tools"
          >
            <Edit />
          </IconButton>
          
          <IconButton
            onClick={() => handleToolClick('font')}
            variant="plain"
            size="sm"
            sx={{ 
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'neutral.100'
              }
            }}
            title="Font settings"
          >
            <TextFields />
          </IconButton>
          
          <IconButton
            onClick={() => handleToolClick('seeker')}
            variant="plain"
            size="sm"
            sx={{ 
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'neutral.100'
              }
            }}
            title="Seek tools"
          >
            <Search />
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  )
}