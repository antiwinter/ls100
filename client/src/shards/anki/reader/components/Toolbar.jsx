import { useEffect } from 'react'
import {
  Box,
  Stack,
  IconButton,
  Typography
} from '@mui/joy'
import { ArrowBack } from '@mui/icons-material'
import { log } from '../../../../utils/logger'

const btnSx = {
  minHeight: 'auto',
  p: 0.5,
  borderRadius: 'sm',
  '&:active': {
    bgcolor: 'transparent'
  }
}

export const Toolbar = ({
  visible = true,
  onBack,
  buttons = [],
  activeKey,
  onSelect
}) => {
  useEffect(() => {
    log.debug(`🔧 Anki toolbar visibility: ${visible}`)
  }, [visible])

  const handleButtonClick = (button) => {
    log.debug('Anki toolbar button:', button.key)
    if (button.onClick) {
      button.onClick(button.key)
      return
    }
    onSelect?.(button.key)
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
      <Stack direction='row' justifyContent='space-between' alignItems='center'
        sx={{ height: '28px' }}>
        <Stack direction='row' spacing={1} alignItems='center'>
          <IconButton
            onClick={onBack}
            variant='plain'
            size='sm'
            sx={{
              minHeight: 'auto',
              p: 0.5
            }}
          >
            <ArrowBack />
          </IconButton>
        </Stack>

        <Stack direction='row' spacing={1} alignItems='center'>
          {buttons.map((button) => {
            const { key, Icon, title: tooltip, variant, color, disabled } = button
            const active = activeKey && activeKey === key
            return (
              <IconButton
                key={key}
                onClick={() => handleButtonClick(button)}
                variant={variant || (active ? 'soft' : 'plain')}
                color={color || (active ? 'primary' : 'neutral')}
                size='sm'
                sx={btnSx}
                title={tooltip}
                disabled={disabled}
              >
                {Icon && <Icon />}
              </IconButton>
            )
          })}
        </Stack>
      </Stack>
    </Box>
  )
}
