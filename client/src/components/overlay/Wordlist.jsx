import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Box, Stack, Typography, IconButton, Input, Chip } from '@mui/joy'
import { Close, Search, KeyboardReturn } from '@mui/icons-material'
import { useLongPress } from '../../utils/useLongPress.js'
import { log } from '../../utils/logger.js'
import { useSessionStore } from './stores/useSessionStore.js'

// Container for word tile with long press handling
const WordTileContainer = ({
  word, editMode, onWordDelete, onLongPress, isHighlighted, onWordClick, isClicked
}) => {
  const { handlers } = useLongPress(onLongPress, { delay: 450 })

  return (
    <Box data-word={word} {...handlers}>
      <WordTile
        word={word}
        editMode={editMode}
        onWordDelete={onWordDelete}
        isHighlighted={isHighlighted}
        onWordClick={onWordClick}
        isClicked={isClicked}
      />
    </Box>
  )
}

// Individual word tile component
const WordTile = ({ word, editMode, onWordDelete, isHighlighted, onWordClick, isClicked }) => {
  const lastTouchRef = useRef(0)

  const handleDelete = useCallback((e) => {
    e.stopPropagation()
    onWordDelete?.(word)
  }, [word, onWordDelete])

  const triggerWordClick = useCallback(() => {
    if (!editMode) {
      onWordClick?.(word)
    }
  }, [editMode, onWordClick, word])

  const handleClick = useCallback((e) => {
    e.preventDefault()
    const now = Date.now()
    if (now - lastTouchRef.current > 300) { // Avoid double-firing with touch
      triggerWordClick()
    }
  }, [triggerWordClick])

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault()
    lastTouchRef.current = Date.now()
    triggerWordClick()
  }, [triggerWordClick])

  return (
    <Box
      className='no-select'
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      sx={{
        position: 'relative',
        px: 1.5,
        py: 0.75,
        borderRadius: 'lg',
        bgcolor: isClicked ? 'background.level2' : (isHighlighted ? 'background.level2' : 'background.level1'),
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'fit-content',
        gap: 0.5,
        '&:hover': {
          bgcolor: 'primary.25'
        }
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
        <Close
          onClick={handleDelete}
          sx={{
            fontSize: '16px',
            color: 'neutral.500',
            cursor: 'pointer',
            '&:hover': {
              color: 'danger.500'
            }
          }}
        />
      )}
    </Box>
  )
}

export const WordListContent = ({ shardId }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [clickedWord, setClickedWord] = useState(null)
  const gridRef = useRef(null)

  // Get session store data
  const sessionStore = useSessionStore(shardId)
  const { wordlist, toggleWord } = sessionStore()

  // Convert Set to Array and filter
  const wordsArray = useMemo(() => Array.from(wordlist || []).sort(), [wordlist])

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
    setSearchExpanded(false)
  }, [])

  const handleSearchExpand = useCallback(() => {
    setSearchExpanded(true)
  }, [])

  const handleSearchCollapse = useCallback(() => {
    if (!searchTerm) {
      setSearchExpanded(false)
    }
  }, [searchTerm])

  const handleWordDelete = useCallback((word) => {
    log.debug('Deleting word:', word)
    toggleWord(word)
  }, [toggleWord])

  const handleQuitEdit = useCallback(() => {
    setEditMode(false)
    log.debug('Edit mode deactivated')
  }, [])

  const copyToClipboard = useCallback(async (text) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      }

      // Fallback for iOS and older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      const result = document.execCommand('copy')
      document.body.removeChild(textArea)
      return result
    } catch (error) {
      log.error('Failed to copy to clipboard:', error)
      return false
    }
  }, [])

  const handleWordClick = useCallback(async (word) => {
    if (editMode) return // Don't copy in edit mode

    const success = await copyToClipboard(word)
    if (success) {
      setClickedWord(word)
      log.debug('Word copied to clipboard:', word)

      // Reset visual feedback after 2 seconds
      setTimeout(() => {
        setClickedWord(null)
      }, 1000)
    }
  }, [editMode, copyToClipboard])

  // Long press handler for tiles to activate edit mode
  const handleTileLongPress = useCallback((e, type) => {
    if (type === 'long' && !editMode) {
      setEditMode(true)
      log.debug('Edit mode activated via long press')
    }
  }, [editMode])

  return (
    <Stack spacing={2} sx={{ height: '100%', pb: '50px' }}>
      <Stack direction='row' spacing={1} alignItems='center' justifyContent='space-between'>
        <Stack direction='row' spacing={1} alignItems='center'>
          <Typography level='title-sm' sx={{ color: 'neutral.500' }}>Wordlist</Typography>
          <Chip variant='soft' size='sm' color='neutral' sx={{ fontSize: '0.75rem', color: 'neutral.400', px: 1 }}>
            {wordsArray.length}
          </Chip>
          {editMode && (
            <Stack
              direction='row'
              alignItems='center'
              spacing={0.5}
              onClick={handleQuitEdit}
              sx={{
                color: 'primary.500',
                cursor: 'pointer',
                pl: 1.5,
                '&:hover': {
                  color: 'primary.600'
                }
              }}
            >
              <Typography level='body-sm'>
                Quit edit
              </Typography>
              <KeyboardReturn sx={{ fontSize: '16px' }} />
            </Stack>
          )}
          {clickedWord && (
            <Typography
              level='body-sm'
              sx={{
                color: 'neutral.400',
                pl: 1.5
              }}
            >
              copied to clipboard
            </Typography>
          )}
        </Stack>

        {searchExpanded ? (
          <Input
            placeholder='Filter...'
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={handleSearchCollapse}
            autoFocus
            startDecorator={<Search sx={{ fontSize: '16px' }} />}
            endDecorator={
              searchTerm && (
                <IconButton
                  size='sm'
                  variant='plain'
                  onClick={handleSearchClear}
                  sx={{ p: 0.5 }}
                >
                  <Close sx={{ fontSize: '14px' }} />
                </IconButton>
              )
            }
            sx={{
              maxWidth: '150px',
              borderRadius: 'lg',
              '--Input-focusedThickness': '1px'
            }}
          />
        ) : (
          <IconButton
            size='sm'
            variant='plain'
            onClick={handleSearchExpand}
            sx={{ color: 'neutral.500' }}
          >
            <Search sx={{ fontSize: '18px' }} />
          </IconButton>
        )}
      </Stack>

      <Box
        ref={gridRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          p: 0.5,
          alignContent: 'flex-start'
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
              onWordClick={handleWordClick}
              isHighlighted={searchTerm.trim() &&
                word.toLowerCase().includes(searchTerm.toLowerCase())}
              isClicked={clickedWord === word}
            />
          ))
        ) : (
          <Box sx={{
            width: '100%',
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




