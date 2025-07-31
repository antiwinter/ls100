import { useState, useEffect } from 'react'
import { 
  Stack,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Box
} from '@mui/joy'
import { Add, VolumeUp } from '@mui/icons-material'
import { ActionDrawer } from '../../../components/ActionDrawer.jsx'
import { log } from '../../../utils/logger'

// Dictionary component using ActionDrawer for positioning and behavior
export const Dict = ({ 
  word, 
  position = 'bottom', // 'top' | 'bottom' 
  visible, 
  onClose, 
  onWordSelect 
}) => {
  const [definition, setDefinition] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load dictionary data for word
  useEffect(() => {
    if (!visible || !word) {
      setDefinition(null)
      setError(null)
      return
    }

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

  // Dictionary content
  const renderContent = () => (
    <Stack spacing={2}>
      {/* Word header with phonetic and audio */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
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

      {/* Loading state */}
      {loading && (
        <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
          <CircularProgress size="sm" />
          <Typography level="body-sm">Loading definition...</Typography>
        </Stack>
      )}

      {/* Error state */}
      {error && (
        <Typography color="danger" level="body-sm">
          {error}
        </Typography>
      )}

      {/* Definition content */}
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

          {/* Add to learning list button */}
          <Button
            fullWidth
            startDecorator={<Add />}
            onClick={handleAddWord}
            variant="solid"
            color="primary"
            sx={{ mt: 2 }}
          >
            Add to Learning List
          </Button>
        </Stack>
      )}
    </Stack>
  )

  return (
    <ActionDrawer
      open={visible}
      onClose={onClose}
      position={position}
      size="fit-content"
    >
      {renderContent()}
    </ActionDrawer>
  )
}