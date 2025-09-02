import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, ToggleButtonGroup, Button, Stack, Alert, IconButton } from '@mui/joy'
import { MenuBook, School, ArrowBack } from '@mui/icons-material'
import { BrowseMode } from './BrowseMode.jsx'
import { StudyMode } from './StudyMode.jsx'
import ankiApi from '../core/ankiApi'
import { StudyEngine } from '../engine/studyEngine.js'
import { apiCall } from '../../../config/api.js'
import { log } from '../../../utils/logger'

const AnkiReaderContent = ({ shard, onBack }) => {
  const [mode, setMode] = useState('browse')
  const [shardData, setShardData] = useState(null)
  const [studyEngine, setStudyEngine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load shard data using new architecture
  const loadShardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!shard?.id) {
        setError('No shard ID provided')
        return
      }

      // Get cards for this shard
      const cards = await ankiApi.getCardsForShard(shard.id)

      // Get unique notes from cards
      const noteIds = [...new Set(cards.map(c => c.noteId))]
      const notes = await Promise.all(
        noteIds.map(async (id) => {
          try {
            return await ankiApi.noteManager.get(id)
          } catch (err) {
            log.warn('Failed to load note:', id, err)
            return null
          }
        })
      )
      const validNotes = notes.filter(Boolean)

      // Get media stats
      const mediaStats = await ankiApi.getMediaStats(shard.id)

      const data = {
        id: shard.id,
        name: shard.name || 'Anki Shard',
        cards,
        notes: validNotes,
        stats: {
          totalCards: cards.length,
          totalNotes: validNotes.length,
          newCards: cards.filter(c => c.reps === 0).length,
          dueCards: cards.filter(c => {
            const due = typeof c.due === 'string' ? Date.parse(c.due) : c.due
            return due <= Date.now()
          }).length,
          mediaFiles: mediaStats.fileCount,
          mediaSize: mediaStats.totalSizeMB
        }
      }

      setShardData(data)
      log.info('✅ Loaded shard data:', {
        shardId: shard.id,
        cards: data.stats.totalCards,
        notes: data.stats.totalNotes,
        media: data.stats.mediaFiles
      })

    } catch (err) {
      log.error('Failed to load shard data:', err)
      setError(`Failed to load shard data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [shard?.id, shard?.name])

  // Load shard data on mount
  useEffect(() => {
    loadShardData()
  }, [shard, loadShardData])

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

  const handleStartStudy = async (options = {}) => {
    if (!shardData?.cards?.length) {
      setError('No cards available for study')
      return
    }

    try {
      // Create study engine for this shard's cards
      const engine = new StudyEngine(shardData.id)
      const session = await engine.initSession(shardData.cards, options)

      setStudyEngine(engine)
      setMode('study')

      log.info('Study session started:', {
        shardId: shardData.id,
        sessionId: session.id,
        queueSize: session.maxCards,
        totalCards: shardData.cards.length
      })
    } catch (err) {
      log.error('Failed to start study session:', err)
      setError('Failed to start study session: ' + err.message)
    }
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
        <Typography color="neutral">Loading shard data...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-sm">{error}</Typography>
          <Button size="sm" onClick={loadShardData} sx={{ mt: 1 }}>
            Retry
          </Button>
        </Alert>
      </Box>
    )
  }

  if (!shardData || shardData.stats.totalCards === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral" sx={{ mb: 2 }}>
          No cards available. Import some .apkg files to get started.
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
            {shardData?.name || 'Anki Shard'}
          </Typography>

          <Typography level="body-sm" color="neutral" sx={{ mr: 2 }}>
            {shardData?.stats.totalNotes} notes • {shardData?.stats.totalCards} cards
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
            selectedDeck={shardData}
            onStartStudy={handleStartStudy}
          />
        ) : (
          <StudyMode
            deck={shardData}
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
