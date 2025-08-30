import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, ToggleButtonGroup, Button, Stack, Alert, IconButton } from '@mui/joy'
import { MenuBook, School, ArrowBack } from '@mui/icons-material'
import { BrowseMode } from './BrowseMode.jsx'
import { StudyMode } from './StudyMode.jsx'
import { deckStorage } from '../storage/storageManager.js'
import { StudyEngine } from '../engine/studyEngine.js'
import { apiCall } from '../../../config/api.js'
import { log } from '../../../utils/logger'

const AnkiReaderContent = ({ shard, onBack }) => {
  const [mode, setMode] = useState('browse')
  const [decks, setDecks] = useState([])
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [studyEngine, setStudyEngine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Define loadDecks BEFORE useEffect that uses it
  const loadDecks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let deckIds = shard?.data?.deckIds || []
      const availableDecks = deckStorage.listDecks()

      // Fallback: if no deckIds in shard but decks exist in storage, use all available decks
      if (deckIds.length === 0 && Object.keys(availableDecks).length > 0) {
        deckIds = Object.keys(availableDecks).map(id => parseInt(id, 10))
        log.info('No deckIds in shard data, using all available decks:', deckIds)
      }

      const loadedDecks = []

      log.debug('AnkiReader loading decks:', {
        deckIds,
        shardData: shard?.data,
        availableDecks: availableDecks
      })

      for (const deckId of deckIds) {
        try {
          const deck = await deckStorage.loadDeck(deckId)
          if (deck) {
            loadedDecks.push(deck)
            log.debug('Deck loaded successfully:', deckId, deck.name)
          } else {
            log.warn('Deck not found:', deckId)
          }
        } catch (err) {
          log.warn('Failed to load deck:', deckId, err)
        }
      }

      setDecks(loadedDecks)

      if (loadedDecks.length > 0 && !selectedDeck) {
        setSelectedDeck(loadedDecks[0])
      }

    } catch (err) {
      log.error('Failed to load decks:', err)
      setError('Failed to load decks')
    } finally {
      setLoading(false)
    }
  }, [shard?.data, selectedDeck])

  // Load decks on mount
  useEffect(() => {
    loadDecks()
  }, [shard, loadDecks])

  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      // End any active study session when switching modes
      if (studyEngine && mode === 'study') {
        studyEngine.endSession()
        setStudyEngine(null)
      }

      setMode(newMode)
    }
  }

  const handleStartStudy = (deck, options = {}) => {
    if (!deck?.cards?.length) {
      setError('No cards available for study')
      return
    }

    // Create study engine for selected deck
    const engine = new StudyEngine(deck.id)
    const session = engine.initSession(deck.cards, options)

    setStudyEngine(engine)
    setSelectedDeck(deck)
    setMode('study')

    log.info('Study session started:', {
      deckId: deck.id,
      sessionId: session.id,
      queueSize: session.maxCards
    })
  }

  const handleEndStudy = () => {
    if (studyEngine) {
      const sessionData = studyEngine.endSession()
      setStudyEngine(null)

      log.info('Study session ended by user:', sessionData)
    }

    setMode('browse')
  }

  // Guard clause for missing shard
  if (!shard) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="danger">No shard data provided</Typography>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Loading decks...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-sm">{error}</Typography>
          <Button size="sm" onClick={loadDecks} sx={{ mt: 1 }}>
            Retry
          </Button>
        </Alert>
      </Box>
    )
  }

  if (decks.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral" sx={{ mb: 2 }}>
          No decks available. Import some .apkg files to get started.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with mode toggle */}
      <Box sx={{
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.surface'
      }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton
            variant="plain"
            size="sm"
            onClick={onBack}
            sx={{ mr: 1 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography level="title-md" sx={{ flex: 1 }}>
            {selectedDeck?.name || 'Anki Deck'}
          </Typography>

          <ToggleButtonGroup
            value={mode}
            onChange={(event, newValue) => {
              if (newValue !== null) {
                handleModeChange(newValue)
              }
            }}
            size="sm"
          >
            <Button
              value="browse"
              variant={mode === 'browse' ? 'solid' : 'outlined'}
              startDecorator={<MenuBook />}
            >
              Browse
            </Button>
            <Button
              value="study"
              variant={mode === 'study' ? 'solid' : 'outlined'}
              startDecorator={<School />}
            >
              Study
            </Button>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      {/* Content area */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'browse' ? (
          <BrowseMode
            decks={decks}
            selectedDeck={selectedDeck}
            onDeckSelect={setSelectedDeck}
            onStartStudy={handleStartStudy}
          />
        ) : (
          <StudyMode
            deck={selectedDeck}
            studyEngine={studyEngine}
            onEndStudy={handleEndStudy}
          />
        )}
      </Box>
    </Box>
  )
}

export const AnkiReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(undefined)
  const [loading, setLoading] = useState(true)

  // Load shard data
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await apiCall(`/api/shards/${shardId}`)
        if (!alive) return
        setShard(data.shard || null)
      } catch (error) {
        log.error('Failed to load shard:', error)
        if (alive) setShard(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [shardId])

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Loading shard...</Typography>
      </Box>
    )
  }

  if (!shard) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="danger">Failed to load shard data</Typography>
      </Box>
    )
  }

  return <AnkiReaderContent shard={shard} onBack={onBack} />
}
