import { useState, useEffect, useRef } from 'react'
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

// Dictionary component - simple props interface
export const Dict = ({ word, position = 'bottom', visible, onClose, onWordSelect }) => {
  const [definition, setDefinition] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollContainerRef = useRef(null)

  // Track drawer visibility changes
  useEffect(() => {
    if (visible && word) {
      log.debug(`📖 Dict drawer visible: ${word}`)
    }
  }, [visible, word])

  // Scroll to top when word changes (keep dict position but reset scroll)
  useEffect(() => {
    if (visible && word && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
      log.debug(`📖 Dict scrolled to top for new word: ${word}`)
    }
  }, [word, visible])

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
        // For now, mock the data structure immediately
        
        setDefinition({
          word: word.toLowerCase(),
          phonetic: `/ˈwɜːrd/`,
          definitions: [
            {
              partOfSpeech: 'noun',
              definition: 'A single distinct meaningful element of speech or writing used by speakers of a particular language to express their thoughts and communicate with others.',
              example: `"The word '${word}' is commonly used in everyday conversation."`
            },
            {
              partOfSpeech: 'verb',
              definition: 'To express something in particular words; to phrase or articulate in a specific manner.',
              example: `"She carefully worded her response to avoid any misunderstanding."`
            },
            {
              partOfSpeech: 'adjective',
              definition: 'Relating to words or the use of words in communication.',
              example: `"His word choice was very precise and effective."`
            }
          ],
          translation: '词汇',
          etymology: 'From Old English "word", from Proto-Germanic "wurdan", meaning "to speak".',
          synonyms: ['term', 'expression', 'phrase', 'vocable', 'lexeme'],
          antonyms: ['silence', 'muteness'],
          usage: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.'
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
    if (word) {
      onWordSelect?.(word)
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

          {definition.etymology && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography level="title-sm">Etymology</Typography>
              <Typography level="body-sm" sx={{ mt: 0.5 }}>
                {definition.etymology}
              </Typography>
            </Box>
          )}

          {definition.synonyms && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography level="title-sm">Synonyms</Typography>
              <Typography level="body-sm" sx={{ mt: 0.5 }}>
                {definition.synonyms.join(', ')}
              </Typography>
            </Box>
          )}

          {definition.antonyms && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography level="title-sm">Antonyms</Typography>
              <Typography level="body-sm" sx={{ mt: 0.5 }}>
                {definition.antonyms.join(', ')}
              </Typography>
            </Box>
          )}

          {definition.usage && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography level="title-sm">Usage Notes</Typography>
              <Typography level="body-sm" sx={{ mt: 0.5 }}>
                {definition.usage}
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
      size="half"
    >
      <Box 
        ref={scrollContainerRef}
        sx={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          // Prevent scroll events from bubbling to parent
          touchAction: 'pan-y',
          // Enable elastic/bounce scrolling on iOS
          WebkitOverflowScrolling: 'touch',
          // Custom scrollbar styling
          scrollbarWidth: 'thin', // Firefox
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--joy-palette-neutral-300)',
            borderRadius: '3px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'var(--joy-palette-neutral-400)'
          }
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => {
          // Only stop propagation if we're actually scrolling within bounds
          const element = e.currentTarget
          const atTop = element.scrollTop === 0
          const atBottom = element.scrollTop >= element.scrollHeight - element.clientHeight
          
          // Get touch delta
          const touch = e.touches[0]
          const deltaY = touch.clientY - (element._lastTouchY || touch.clientY)
          element._lastTouchY = touch.clientY
          
          // Stop propagation if we're scrolling within the content bounds
          if ((!atTop && deltaY > 0) || (!atBottom && deltaY < 0)) {
            e.stopPropagation()
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation()
          delete e.currentTarget._lastTouchY
        }}
      >
        {renderContent()}
      </Box>
    </ActionDrawer>
  )
}