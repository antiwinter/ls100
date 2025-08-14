import { useRef } from 'react'
import {
  Box,
  Typography,
  Button,
  Stack
} from '@mui/joy'
import { CheckCircleOutline, CheckCircle, Close, Delete, Edit } from '@mui/icons-material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMask } from '@fortawesome/free-solid-svg-icons'

// Custom mask icon with optional slash overlay
const MaskIcon = ({ withSlash = false }) => (
  <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <FontAwesomeIcon icon={faMask} style={{ fontSize: 20 }} />
    {withSlash && (
      <Box
        sx={{
          position: 'absolute',
          width: '120%',
          height: '2px',
          bgcolor: 'currentColor',
          transform: 'rotate(-45deg)',
          borderRadius: 1
        }}
      />
    )}
  </Box>
)

// Reusable action button component
const ActionButton = ({ icon, text, onClick, disabled, color, bgColor, textColor }) => {
  const buttonRef = useRef(null)

  const handlePress = () => {
    if (buttonRef.current) {
      buttonRef.current.style.backgroundColor = bgColor
      setTimeout(() => {
        if (buttonRef.current) {
          buttonRef.current.style.backgroundColor = 'transparent'
        }
      }, 200)
    }
    onClick()
  }

  return (
    <Button
      ref={buttonRef}
      onClick={handlePress}
      disabled={disabled}
      color={disabled ? 'neutral' : color}
      variant="plain"
      size="md"
      sx={{
        flexDirection: 'column',
        width: 100,
        fontWeight: 'normal',
        fontSize: 'xs',
        py: 0.75,
        height: 'auto',
        transition: 'background-color 0.2s ease-out',
        ...(textColor && !disabled && { color: textColor })
      }}
    >
      <Box sx={{ mb: 0.25 }}>
        {icon}
      </Box>
      <Box
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%'
        }}
      >
        {text}
      </Box>
    </Button>
  )
}

export const BrowserEditBar = ({ selectedCount, totalCount, selectedShards = [], onSelectAll, onCancel, onDelete, onEdit, onMakePublic, onMakePrivate }) => {
  const allSelected = selectedCount === totalCount
  const disabled = selectedCount === 0
  const hasPublicShard = selectedShards.some(shard => shard.public)

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
            <ActionButton
              icon={<Delete sx={{ fontSize: 20, color: disabled ? 'inherit' : '#FD7A7A' }} />}
              text="Delete"
              onClick={onDelete}
              disabled={disabled}
              color={undefined}
              bgColor="#FEE2E2"
              textColor="#FD7A7A"
            />

            <ActionButton
              icon={<Edit sx={{ fontSize: 20 }} />}
              text="Edit"
              onClick={onEdit}
              disabled={disabled || selectedCount !== 1}
              color="primary"
              bgColor="#E0F2FE"
            />

            <ActionButton
              icon={<MaskIcon withSlash={!hasPublicShard} />}
              text={hasPublicShard ? 'Make private' : 'Make public'}
              onClick={hasPublicShard ? onMakePrivate : onMakePublic}
              disabled={disabled}
              color="primary"
              bgColor="#E0F2FE"
            />
          </Stack>
        </Stack>
      </Box>
    </>
  )
}
