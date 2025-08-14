import { Box, Typography, Button, Divider, IconButton } from '@mui/joy'
import { IosShare, Add, Search, Edit } from '@mui/icons-material'

// Pure share icon button
const ShareButton = () => {
  return (
    <IconButton
      variant="plain"
      color="primary"
      sx={{
        fontSize: '28px',
        animation: 'bounce 2s infinite',
        '@keyframes bounce': {
          '0%, 20%, 50%, 80%, 100%': {
            transform: 'translateY(0)'
          },
          '40%': {
            transform: 'translateY(-12px)'
          },
          '60%': {
            transform: 'translateY(-6px)'
          }
        }
      }}
    >
      <IosShare />
    </IconButton>
  )
}

// Menu item component
const MenuItem = ({ icon, title, isFirst = false, isLast = false }) => {
  return (
    <Button
      variant="plain"
      color="neutral"
      sx={{
        py: 1.2, // Reduced vertical padding
        px: 2,
        bgcolor: 'white',
        border: 'none',
        borderRadius: 0,
        ...(isFirst && {
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }),
        ...(isLast && {
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        color: 'text.primary',
        '&:hover': {
          bgcolor: 'neutral.50'
        }
      }}
    >
      <Typography level="body-md" sx={{ color: 'text.primary', fontWeight: 'normal' }}>
        {title}
      </Typography>
      {icon}
    </Button>
  )
}

// Fake menu group with gradient overlay
const MenuGroup = () => {
  return (
    <Box sx={{ position: 'relative', width: '100%', bgColor: 'white' }}> {/* Increased width */}
      <Box sx={{ width: '100%' }}>
        <MenuItem
          title="Add to Home Screen"
          icon={<Add sx={{ fontSize: '20px' }} />}
          isFirst={true}
        />
        <Divider sx={{ m: 0 }} />
        <MenuItem
          title="Find on Page"
          icon={<Search sx={{ fontSize: '20px' }} />}
        />
        <Divider sx={{ m: 0 }} />
        <MenuItem
          title="Add to Quick Note"
          icon={<Edit sx={{ fontSize: '20px' }} />}
          isLast={true}
        />
      </Box>

      {/* Gradient overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,1) 100%)',
          borderRadius: '12px',
          pointerEvents: 'none'
        }}
      />
    </Box>
  )
}

export const Hint = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.level1', // Joy UI level1 background
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start', // Move to bottom
        p: 3,
        gap: 6,
        transition: 'opacity 0.3s ease-out',
        cursor: 'pointer',
        transform: 'scaleY(-1)' // Mirror flip top to bottom
      }}
    >
      {/* Pure Share Icon */}
      <ShareButton />

      {/* Fake Menu Group with Gradient Overlay */}
      <MenuGroup />
    </Box>
  )
}
