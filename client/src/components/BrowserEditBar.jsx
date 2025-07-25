import { useRef } from 'react'
import {
  Box,
  Typography,
  Button,
  Stack
} from '@mui/joy'
import { CheckCircleOutline, CheckCircle, Close, Delete, Public, Lock } from '@mui/icons-material'

export const BrowserEditBar = ({ selectedCount, totalCount, onSelectAll, onCancel, onDelete, onMakePublic, onMakePrivate }) => {
  const allSelected = selectedCount === totalCount
  const disabled = selectedCount === 0
  const deleteRef = useRef(null)
  const publicRef = useRef(null)
  const privateRef = useRef(null)

  const handleButtonPress = (buttonRef, bgColor, originalHandler) => {
    if (buttonRef.current) {
      buttonRef.current.style.backgroundColor = bgColor
      setTimeout(() => {
        if (buttonRef.current) {
          buttonRef.current.style.backgroundColor = 'transparent'
        }
      }, 200)
    }
    originalHandler()
  }

  return (
    <>
      {/* Top Edit Bar */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        bgcolor: 'background.body',
        py: 1,
        px: 2
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            startDecorator={<Close />}
            onClick={onCancel}
            variant="plain"
            size="sm"
            sx={{ 
              fontSize: 'sm',
              fontWeight: 'normal',
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'transparent'
              },
              '&:active': {
                bgcolor: 'transparent'
              }
            }}
          >
          </Button>
          
          <Button
            startDecorator={allSelected ? <CheckCircle /> : <CheckCircleOutline />}
            onClick={onSelectAll}
            variant="plain"
            size="sm"
            sx={{ 
              fontSize: 'sm',
              fontWeight: 'normal',
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'transparent'
              },
              '&:active': {
                bgcolor: 'transparent'
              }
            }}
          >
            {allSelected ? 'Unselect all' : 'Select all'}
          </Button>
        </Stack>
      </Box>

      {/* Bottom Action Bar */}
      <Box sx={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: 'background.body',
        borderTop: 1,
        borderColor: 'divider',
        p: 1.5,
        zIndex: 1000
      }}>
        <Stack direction="column" spacing={1} alignItems="stretch">
          <Typography 
            level="body-sm" 
            sx={{ 
              fontWeight: 'bold',
              color: 'primary.500',
              textAlign: 'center',
              mb: 0.5
            }}
          >
            {selectedCount} selected
          </Typography>
          
          <Stack direction="row" spacing={3} justifyContent="center">
            <Button
            ref={deleteRef}
            onClick={() => handleButtonPress(deleteRef, '#FEE2E2', onDelete)}
            disabled={disabled}
            color={disabled ? 'neutral' : undefined}
            variant="plain"
            size="md"
            sx={{
              flexDirection: 'column',
              minWidth: 'auto',
              fontWeight: 'normal',
              fontSize: 'xs',
              py: 0.75,
              height: 'auto',
              ...(!disabled && {
                color: '#FD7A7A'
              }),
              transition: 'background-color 0.2s ease-out'
            }}
          >
            <Delete sx={{ 
              fontSize: 20, 
              mb: 0.25,
              color: disabled ? 'inherit' : '#FD7A7A'
            }} />
            Delete
          </Button>
          
          <Button
            ref={publicRef}
            onClick={() => handleButtonPress(publicRef, '#E0F2FE', onMakePublic)}
            disabled={disabled}
            color={disabled ? 'neutral' : 'primary'}
            variant="plain"
            size="md"
            sx={{
              flexDirection: 'column',
              minWidth: 'auto',
              fontWeight: 'normal',
              fontSize: 'xs',
              py: 0.75,
              height: 'auto',
              transition: 'background-color 0.2s ease-out'
            }}
          >
            <Public sx={{ fontSize: 20, mb: 0.25 }} />
            Public
          </Button>
          
          <Button
            ref={privateRef}
            onClick={() => handleButtonPress(privateRef, '#E0F2FE', onMakePrivate)}
            disabled={disabled}
            color={disabled ? 'neutral' : 'primary'}
            variant="plain"
            size="md"
            sx={{
              flexDirection: 'column',
              minWidth: 'auto',
              fontWeight: 'normal',
              fontSize: 'xs',
              py: 0.75,
              height: 'auto',
              transition: 'background-color 0.2s ease-out'
            }}
          >
            <Lock sx={{ fontSize: 20, mb: 0.25 }} />
            Private
          </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  )
}