import { Stack, Typography, Button, Box, Divider } from '@mui/joy'
import { ActionDrawer } from './ActionDrawer.jsx'

export const MenuDrawer = ({ 
  open, 
  onClose, 
  title,
  entries = [],
  size = 'fit-content'
}) => {
  
  const handleEntryClick = async (entry) => {
    if (entry.action) {
      await entry.action()
    }
  }
  
  return (
    <ActionDrawer
      open={open}
      onClose={onClose}
      size={size}
      title={title}
      background="#f8f9fa"
    >
      {/* Menu Groups */}
      <Box sx={{
        bgcolor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        {entries.map((entry, index) => (
          <Box key={index}>
            <Button
              variant="plain"
              onClick={() => handleEntryClick(entry)}
              disabled={!entry.action}
              sx={{
                width: '100%',
                justifyContent: 'space-between',
                py: 1.5,
                px: 2,
                borderRadius: 0,
                fontWeight: 'normal',
                color: 'text.primary',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&:disabled': {
                  color: 'text.tertiary',
                  cursor: 'not-allowed'
                }
              }}
            >
              <Typography level="body-md">
                {entry.entryName}
              </Typography>
              
              {entry.icon && (
                <Box sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  color: 'text.secondary'
                }}>
                  {entry.icon}
                </Box>
              )}
            </Button>
            
            {/* Divider between entries (not after last) */}
            {index < entries.length - 1 && (
              <Divider sx={{ 
                mx: 2,
                borderColor: 'rgba(0, 0, 0, 0.06)'
              }} />
            )}
          </Box>
        ))}
      </Box>
    </ActionDrawer>
  )
}
