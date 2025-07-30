import { useState, useEffect } from 'react'
import { 
  Box, 
  Modal,
  Stack,
  Typography,
  Button,
  IconButton,
  CircularProgress
} from '@mui/joy'
import { Close, Add, VolumeUp } from '@mui/icons-material'
import { log } from '../../../utils/logger'

// Context-aware dictionary display with smart positioning
export const DictDrawer = ({ 
  word, 
  position = 'bottom', // 'top' | 'bottom' 
  visible, 
  onClose, 
  onWordSelect 
}) => {
  const [definition, setDefinition] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Calculate position based on word location
  const calcPosition = (element) => {
    if (!element) return 'bottom'
    
    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const isUpperHalf = rect.top < (viewportHeight / 2)
    
    return isUpperHalf ? 'top' : 'bottom'
  }

  // Load dictionary data for word
  useEffect(() => {
    if (!visible || !word) return

    const loadDefinition = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // TODO: Replace with actual dictionary API call
        // For now, mock the data structure
        await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API delay
        
        setDefinition({
          word: word.toLowerCase(),
          phonetic: `/ˈwɜːrd/`,
          definitions: [
            {
              partOfSpeech: 'noun',
              definition: 'A single distinct meaningful element of speech or writing.',
              example: `"The word '${word}' is commonly used."`
            }
          ],
          translation: '词汇' // Mock translation
        })
      } catch (err) {
        log.error('Failed to load definition:', err)
        setError('Failed to load definition')
      } finally {
        setLoading(false)
      }
    }

    loadDefinition()
  }, [visible, word])

  // Handle adding word to learning list
  const handleAddWord = () => {
    if (onWordSelect && word) {
      onWordSelect(word)
      log.debug('Added word to selection:', word)
    }
  }

  // Handle pronunciation playback (placeholder)
  const handlePlayAudio = () => {
    log.debug('Play pronunciation for:', word)
    // TODO: Implement text-to-speech or audio playback
  }

  if (!visible || !word) return null

  return (
    <Modal
      open={visible}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: position === 'top' ? 'flex-start' : 'flex-end',
        justifyContent: 'center',
        zIndex: 1200
      }}
    >
      <Box
        onClick={(e) => e.target === e.currentTarget && onClose()}
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: position === 'top' ? 'flex-start' : 'flex-end',
          justifyContent: 'center',
          pt: position === 'top' ? 2 : 0,
          pb: position === 'bottom' ? 2 : 0
        }}
      >
        <Box
          sx={{
            bgcolor: 'background.body',
            borderRadius: 'lg',
            width: '90%',
            maxWidth: '400px',
            maxHeight: '45vh',
            boxShadow: 'lg',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transform: position === 'top' 
              ? 'translateY(0)' 
              : 'translateY(0)',
            animation: `slide${position === 'top' ? 'Down' : 'Up'} 0.3s ease-out`
          }}
        >
          {/* Header */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="h4">{word}</Typography>
              {definition?.phonetic && (
                <Typography level="body-sm" color="neutral">
                  {definition.phonetic}
                </Typography>
              )}
              <IconButton
                size="sm"
                variant="plain"
                onClick={handlePlayAudio}
                sx={{ color: 'neutral.500' }}
              >
                <VolumeUp />
              </IconButton>
            </Stack>
            <IconButton
              size="sm"
              variant="plain"
              onClick={onClose}
              sx={{ color: 'neutral.500' }}
            >
              <Close />
            </IconButton>
          </Stack>

          {/* Content */}
          <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
            {loading && (
              <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
                <CircularProgress size="sm" />
                <Typography level="body-sm">Loading definition...</Typography>
              </Stack>
            )}

            {error && (
              <Typography color="danger" level="body-sm">
                {error}
              </Typography>
            )}

            {definition && !loading && (
              <Stack spacing={2}>
                {definition.definitions.map((def, idx) => (
                  <Box key={idx}>
                    <Typography level="title-sm" color="primary">
                      {def.partOfSpeech}
                    </Typography>
                    <Typography level="body-sm" sx={{ mt: 0.5 }}>
                      {def.definition}
                    </Typography>
                    {def.example && (
                      <Typography 
                        level="body-xs" 
                        color="neutral" 
                        sx={{ mt: 0.5, fontStyle: 'italic' }}
                      >
                        {def.example}
                      </Typography>
                    )}
                  </Box>
                ))}

                {definition.translation && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography level="title-sm">Translation</Typography>
                    <Typography level="body-sm" sx={{ mt: 0.5 }}>
                      {definition.translation}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Box>

          {/* Actions */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button
              fullWidth
              startDecorator={<Add />}
              onClick={handleAddWord}
              variant="solid"
              color="primary"
            >
              Add to Learning List
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  )
}

// CSS animations for slide effects
const style = document.createElement('style')
style.textContent = `
  @keyframes slideDown {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`
document.head.appendChild(style)