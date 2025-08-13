import { useEffect } from 'react'
import {
  Box,
  Stack,
  IconButton
} from '@mui/joy'
import { 
  ArrowBack,
  ListAltOutlined,
  BookmarkBorder,
  IosShare,
  TextFields,
  Search
} from '@mui/icons-material'
import { log } from '../../../../utils/logger'

// shared button styles to avoid inline object duplication
const btnSx = {
  minHeight: 'auto',
  p: 0.5,
  '&:hover': {
    bgcolor: 'neutral.100'
  }
}

// right-side toolbar buttons in order
const BUTTONS = [
  { key: 'export', title: 'Export', Icon: IosShare },
  { key: 'wordlist', title: 'Word list', Icon: ListAltOutlined },
  { key: 'bookmark', title: 'Bookmark', Icon: BookmarkBorder },
  { key: 'search', title: 'Search', Icon: Search },
  { key: 'font', title: 'Font settings', Icon: TextFields }
]

// Top slide-down toolbar with auto-hide and tool buttons
export const Toolbar = ({ 
  visible, 
  onBack, 
  onToolSelect
}) => {
  // Log visibility changes for debugging
  useEffect(() => {
    log.debug(`🔧 Toolbar visibility: ${visible}`)
  }, [visible])

  // Handle tool selection
  const handleToolClick = (tool) => {
    log.debug('Tool selected:', tool)
    if (onToolSelect) {
      onToolSelect(tool)
    }
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
        borderBottom: visible ? 1 : 0,
        borderColor: 'divider',
        transform: visible ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 0.3s ease-out',
        boxShadow: visible ? 'sm' : 'none'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {/* Left side: Back button */}
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
        </Stack>
        
        {/* Right side: Tool buttons */}
        <Stack direction="row" spacing={1} alignItems="center">
          {BUTTONS.map((button) => (
            <IconButton
              key={button.key}
              onClick={() => handleToolClick(button.key)}
              variant="plain"
              size="sm"
              sx={btnSx}
              title={button.title}
            >
              <button.Icon />
            </IconButton>
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}