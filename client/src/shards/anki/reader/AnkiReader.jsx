import { useState, useEffect, useCallback, useMemo } from 'react'
import { Box, Typography, ToggleButtonGroup, Button, Stack, Alert, IconButton } from '@mui/joy'
import { MenuBook, School, ArrowBack } from '@mui/icons-material'
import { BrowseMode } from './BrowseMode.jsx'
import { StudyMode } from './StudyMode.jsx'
import anki from '../core/index.js'
import { useAnkiSessionStore } from '../storage/useSessionStore.js'
import { apiCall } from '../../../config/api.js'
import { log } from '../../../utils/logger'

// Hook to get counts dynamically from bundleIds
const useCounts = (bundleIds) => {
  const [counts, setCounts] = useState({ cards: 0, notes: 0 })

  useEffect(() => {
    if (!bundleIds?.length) {
      setCounts({ cards: 0, notes: 0 })
      return
    }

    const fetchCounts = async () => {
      try {
        const cards = await anki.getCardsForBundles(bundleIds)
        const noteIds = [...new Set(cards.map(c => c.noteId))]
        setCounts({ cards: cards.length, notes: noteIds.length })
      } catch (error) {
        log.error('Failed to fetch counts:', error)
        setCounts({ cards: 0, notes: 0 })
      }
    }

    fetchCounts()
  }, [bundleIds])

  return counts
}

const AnkiReaderContent = ({ shard, onBack }) => {
  const [mode, setMode] = useState('browse')
  const [shardData, setShardData] = useState(null)
  const [studyEngine, setStudyEngine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Session store for persistent study settings
  const sessionStore = useAnkiSessionStore(shard?.id)

  // Get bundleIds and counts (must be at top level)
  const bundleIds = useMemo(() =>
    shardData?.metadata?.bundles?.map(b => b.id) || [],
  [shardData?.metadata?.bundles]
  )
  const counts = useCounts(bundleIds)

  // Load shard data using new architecture
  const loadShardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!shard?.id) {
        setError('No shard ID provided')
        return
      }

      // Minimal shardData - just metadata for single source of truth
      const data = {
        id: shard.id,
        name: shard.name || 'Anki Shard',
        metadata: shard.metadata
      }

      setShardData(data)

      const bundleIds = shard.metadata?.bundles?.map(b => b.id) || []
      log.info('✅ Loaded shard data:', {
        shardId: shard.id,
        bundles: bundleIds.length
      })

    } catch (err) {
      log.error('Failed to load shard data:', err)
      setError(`Failed to load shard data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [shard?.id, shard?.name, shard?.metadata])

  // Load shard data on mount
  useEffect(() => {
    loadShardData()
  }, [shard, loadShardData])

  const handleModeChange = (newMode) => {
    if (newMode !== mode)
      setMode(newMode)
  }

  const handleStartStudy = async () => {
    if (!counts.cards) {
      setError('No cards available for study')
      return
    }

    try {
      // Configure session store with shard's bundleIds before initializing engine
      sessionStore.setState({ bundleIds })

      // Create study engine and initialize session
      const engine = new anki.StudyEngine(sessionStore)
      await engine.init(sessionStore)

      setStudyEngine(engine)
      setMode('study')

      const sessionState = sessionStore.getState()
      log.info('Study session started:', {
        shardId: shard.id,
        bundleIds: sessionState.bundleIds,
        day: sessionState.day,
        newCards: sessionState.pile?.new?.length || 0,
        reviewCards: sessionState.pile?.review?.length || 0,
        totalCards: counts.cards
      })
    } catch (err) {
      log.error('Failed to start study session:', err)
      setError('Failed to start study session: ' + err.message)
    }
  }

  const handleEndStudy = () => {
    // Clean up study engine reference (session already ended in StudyMode)
    if (studyEngine) {
      log.info('Cleaning up study engine reference')
      setStudyEngine(null)
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

  if (!bundleIds.length) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral" sx={{ mb: 2 }}>
          No content available. Import some .apkg files to get started.
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
            {counts.notes} notes • {counts.cards} cards
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
            bundleIds={bundleIds}
            shardName={shardData.name}
            onStartStudy={handleStartStudy}
          />
        ) : (
          <StudyMode
            bundleIds={bundleIds}
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
