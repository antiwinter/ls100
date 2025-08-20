import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Box, Stack, Typography, IconButton, Input, Chip } from '@mui/joy'
import { Close, Delete, Search, Edit } from '@mui/icons-material'
import { useLongPress } from '../../utils/useLongPress.js'
import { log } from '../../utils/logger.js'

// Container for word tile with long press handling
const WordTileContainer = ({ word, editMode, onWordDelete, onLongPress, isHighlighted }) => {
  const { handlers } = useLongPress(onLongPress, { delay: 450 })

  return (
    <Box data-word={word} {...handlers}>
      <WordTile
        word={word}
        editMode={editMode}
        onWordDelete={onWordDelete}
        isHighlighted={isHighlighted}
      />
    </Box>
  )
}

// Individual word tile component
const WordTile = ({ word, editMode, onWordDelete, isHighlighted }) => {
  const handleDelete = useCallback((e) => {
    e.stopPropagation()
    onWordDelete?.(word)
  }, [word, onWordDelete])

  return (
    <Box
      sx={{
        position: 'relative',
        p: 1.5,
        border: 1,
        borderColor: isHighlighted ? 'primary.500' : 'neutral.300',
        borderRadius: 'sm',
        bgcolor: isHighlighted ? 'primary.50' : 'background.surface',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&:hover': {
          borderColor: 'primary.400',
          bgcolor: 'primary.25'
        },
        ...(editMode && {
          borderColor: 'danger.300',
          bgcolor: 'danger.25'
        })
      }}
    >
      <Typography
        level="body-sm"
        sx={{
          fontWeight: 500,
          textAlign: 'center',
          wordBreak: 'break-word'
        }}
      >
        {word}
      </Typography>

      {editMode && (
        <IconButton
          size="sm"
          variant="solid"
          color="danger"
          onClick={handleDelete}
          sx={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            minHeight: '24px',
            minWidth: '24px',
            p: 0
          }}
        >
          <Delete sx={{ fontSize: '14px' }} />
        </IconButton>
      )}
    </Box>
  )
}

// Search bar component
const SearchBar = ({ searchTerm, onSearchChange, onClear }) => {
  return (
    <Input
      placeholder='Search words...'
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
      startDecorator={<Search sx={{ fontSize: '18px' }} />}
      endDecorator={
        searchTerm && (
          <IconButton
            size='sm'
            variant='plain'
            onClick={onClear}
            sx={{ p: 0.5 }}
          >
            <Close sx={{ fontSize: '16px' }} />
          </IconButton>
        )
      }
      sx={{
        mb: 2,
        '--Input-focusedThickness': '2px'
      }}
    />
  )
}

export const WordListContent = ({ selectedWords, onWordDelete }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [editMode, setEditMode] = useState(false)
  const gridRef = useRef(null)

  // Convert Set to Array and filter
  const wordsArray = useMemo(() => Array.from(selectedWords).sort(), [selectedWords])

  const filteredWords = useMemo(() => {
    if (!searchTerm.trim()) return wordsArray
    const term = searchTerm.toLowerCase()
    return wordsArray.filter(word =>
      word.toLowerCase().includes(term)
    )
  }, [wordsArray, searchTerm])

  // Scroll to first matching word when search changes
  const scrollToMatch = useCallback(() => {
    if (!searchTerm.trim() || !gridRef.current) return

    const firstMatch = filteredWords[0]
    if (!firstMatch) return

    // Find the tile element and scroll to it
    const tileElement = gridRef.current.querySelector(`[data-word="${firstMatch}"]`)
    if (tileElement) {
      tileElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [searchTerm, filteredWords])

  // Auto-scroll when search results change
  useEffect(() => {
    const timer = setTimeout(scrollToMatch, 100)
    return () => clearTimeout(timer)
  }, [scrollToMatch])

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value)
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchTerm('')
  }, [])

  const handleWordDelete = useCallback((word) => {
    log.debug('Deleting word:', word)
    onWordDelete?.(word)
  }, [onWordDelete])

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev)
  }, [])

  // Long press handler for tiles to activate edit mode
  const handleTileLongPress = useCallback((e, type) => {
    if (type === 'long' && !editMode) {
      setEditMode(true)
      log.debug('Edit mode activated via long press')
    }
  }, [editMode])

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Stack direction='row' spacing={1} alignItems='center'>
        <Box sx={{ flex: 1 }}>
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onClear={handleSearchClear}
          />
        </Box>
        <IconButton
          variant={editMode ? 'solid' : 'outlined'}
          color={editMode ? 'danger' : 'neutral'}
          onClick={toggleEditMode}
          sx={{ flexShrink: 0 }}
        >
          <Edit />
        </IconButton>
      </Stack>

      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Typography level='body-sm' color='neutral'>
          {filteredWords.length} of {wordsArray.length} words
        </Typography>
        {editMode && (
          <Chip size='sm' color='danger' variant='soft'>
            Edit Mode
          </Chip>
        )}
      </Stack>

      <Box
        ref={gridRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 1.5,
          p: 0.5
        }}
      >
        {filteredWords.length > 0 ? (
          filteredWords.map((word) => (
            <WordTileContainer
              key={word}
              word={word}
              editMode={editMode}
              onWordDelete={handleWordDelete}
              onLongPress={handleTileLongPress}
              isHighlighted={searchTerm.trim() &&
                word.toLowerCase().includes(searchTerm.toLowerCase())}
            />
          ))
        ) : (
          <Box sx={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            py: 4
          }}>
            <Typography level='body-sm' color='neutral'>
              {searchTerm.trim() ? 'No words match your search' : 'No words saved yet'}
            </Typography>
          </Box>
        )}
      </Box>
    </Stack>
  )
}




