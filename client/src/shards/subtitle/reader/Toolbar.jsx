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

  // Auto-hide after 3 seconds of inactivity
  useEffect(() => {
    if (visible) {
      setIsVisible(true)
      
      // Clear existing timer
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
      }
      
      // Set new hide timer
      hideTimer.current = setTimeout(() => {
        setIsVisible(false)
      }, 3000)
    } else {
      setIsVisible(false)
    }

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
      }
    }
  }, [visible])

  // Handle tool selection
  const handleToolClick = (tool) => {
    log.debug('Tool selected:', tool)
    if (onToolSelect) {
      onToolSelect(tool)
    }
  }

  // Keep toolbar visible while interacting
  const handleMouseEnter = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
    }
  }

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => {
      setIsVisible(false)
    }, 1000) // Shorter delay when mouse leaves
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
        borderBottom: 1,
        borderColor: 'divider',
        transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease-out',
        boxShadow: 'sm'
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