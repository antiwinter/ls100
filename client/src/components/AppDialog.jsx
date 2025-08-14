import {
  Modal,
  ModalDialog,
  Typography,
  Box,
  IconButton
} from '@mui/joy'
import { Close } from '@mui/icons-material'

export const AppDialog = ({
  open,
  onClose,
  title,
  children,
  maxWidth = 600,
  showCloseButton = true,
  sx = {}
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <ModalDialog
        sx={{
          width: '90vw',
          maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRadius: 16,
          border: 'none',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          pt: 2,
          ...sx
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: title ? 2 : 1
            }}
          >
            {title && (
              <Typography
                level="h4"
                sx={{
                  fontWeight: 'bold',
                  fontSize: '1.25rem',
                  color: 'text.primary'
                }}
              >
                {title}
              </Typography>
            )}
            {showCloseButton && (
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                onClick={onClose}
                sx={{
                  minHeight: 32,
                  minWidth: 32
                }}
              >
                <Close />
              </IconButton>
            )}
          </Box>
        )}

        {/* Content */}
        <Box>
          {children}
        </Box>
      </ModalDialog>
    </Modal>
  )
}
