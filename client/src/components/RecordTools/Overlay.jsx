import { Box, Typography } from '@mui/joy'

export const Overlay = ({ isRecording, duration }) => {
  if (!isRecording) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: 'danger.500',
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.3 }
            }
          }}
        />
        <Typography level="h3" sx={{ color: 'white' }}>
          Recording...
        </Typography>
      </Box>
      <Typography level="h2" sx={{ color: 'white', fontVariantNumeric: 'tabular-nums' }}>
        {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
      </Typography>
    </Box>
  )
}

