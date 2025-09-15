import { useState, useEffect, useCallback, useMemo } from 'react'
import { Box, Typography, Alert, Button } from '@mui/joy'
import { Collections } from '@mui/icons-material'
import anki from '../core/index.js'
import { StudyMode } from './StudyMode.jsx'
import { FixedSizeList as List } from 'react-window'
import { Toolbar } from './overlay/Toolbar.jsx'
import { AnkiSessionStore } from '../core/sessionStore.js'
import { apiCall } from '../../../config/api.js'
import { log } from '../../../utils/logger'

// Layout constants for FixedSizeList height calculation
const TOOLBAR_HEIGHT = 70 // Toolbar height
const HEADER_HEIGHT = 80   // Shard name + count section
const FIELD_HEADER_HEIGHT = 60 // Field names header
const ITEM_HEIGHT = 90     // Fixed height per note row


// Note row component for FixedSizeList
const NoteRow = ({ index, note, fieldNames, style }) => {
  return (
    <Box
      style={{
        ...style,
        display: 'flex',
        padding: '12px',
        borderBottom: '1px solid var(--joy-palette-divider)',
        alignItems: 'center'
      }}
      sx={{
        '&:hover': { bgcolor: 'background.level1' }
      }}
    >
      {/* Index column */}
      <Box sx={{ minWidth: 60, pr: 2, textAlign: 'center' }}>
        <Typography level="body-sm" fontWeight="bold">
          {index + 1}
        </Typography>
      </Box>

      {/* Dynamic field columns */}
      {fieldNames.map((fieldName, idx) => (
        <Box key={fieldName} sx={{ flex: 1, pr: 2, minWidth: 0 }}>
          <Box
            sx={{
              fontSize: 'sm',
              lineHeight: 1.4,
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              '& img': {
                maxHeight: '40px',
                maxWidth: '80px',
                objectFit: 'contain'
              }
            }}
            dangerouslySetInnerHTML={{ __html: note.fields?.[idx] || '' }}
          />
        </Box>
      ))}
    </Box>
  )
}


const AnkiReaderContent = ({ shard, onBack }) => {
  const [shardData, setShardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('browse')
  const [studyEngine, setStudyEngine] = useState(null)
  const [notes, setNotes] = useState([])
  const [bundles, setBundles] = useState({})

  // Session store for study functionality (Valtio proxy)
  const sessionStore = AnkiSessionStore(shard?.id)

  // Get bundleIds (must be at top level)
  const bundleIds = useMemo(() =>
    shardData?.metadata?.bundles?.map(b => b.id) || [],
  [shardData?.metadata?.bundles]
  )

  // Calculate dynamic field names across all bundles
  const fieldNames = useMemo(() => {
    const allFields = new Set()
    Object.values(bundles).forEach(bundle => {
      if (bundle?.fields) {
        bundle.fields.forEach(field => allFields.add(field))
      }
    })
    return Array.from(allFields)
  }, [bundles])

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

  // Load notes for bundle IDs (after shard data loaded)
  useEffect(() => {
    const loadNotesData = async () => {
      if (!bundleIds.length) {
        setNotes([])
        setBundles({})
        return
      }

      try {
        // Get notes for these bundles by finding cards first, then getting unique notes
        const shardCards = await anki.getCardsForBundles(bundleIds)
        const noteIds = [...new Set(shardCards.map(c => c.noteId))]

        const shardNotes = await Promise.all(
          noteIds.map(async (id) => {
            try {
              return await anki.noteManager.get(id)
            } catch (err) {
              log.warn('Failed to load note:', id, err)
              return null
            }
          })
        )
        const validNotes = shardNotes.filter(Boolean)

        // Load note types for the notes
        const types = {}
        for (const note of validNotes) {
          if (!types[note.bundleId]) {
            types[note.bundleId] = await anki.getBundle(note.bundleId)
          }
        }

        setNotes(validNotes)
        setBundles(types)
        log.debug('Loaded notes data:', {
          notes: validNotes.length,
          bundles: Object.keys(types).length
        })
      } catch (error) {
        log.error('Failed to load notes data:', error)
        setNotes([])
        setBundles({})
      }
    }

    loadNotesData()
  }, [bundleIds])

  // Handle toolbar actions
  const handleToolSelect = async (tool) => {
    switch (tool) {
    case 'study':
      await handleStartStudy()
      break
    case 'statistics':
    case 'settings':
    case 'search':
      log.debug('Toolbar action placeholder:', tool)
      break
    default:
      log.warn('Unknown tool action:', tool)
    }
  }

  // Handle study mode
  const handleStartStudy = async () => {
    if (!notes.length) {
      setError('No notes available for study')
      return
    }

    try {
      // Configure session with bundleIds
      sessionStore.bundleIds = bundleIds

      // Create study engine and initialize session
      const engine = new anki.StudyEngine(sessionStore)
      await engine.init(sessionStore)

      setStudyEngine(engine)
      setMode('study')
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

  // FixedSizeList item renderer
  const renderNote = ({ index, style }) => {
    const note = notes[index]
    if (!note) return null

    return (
      <NoteRow
        index={index}
        style={style}
        note={note}
        fieldNames={fieldNames}
      />
    )
  }

  // Calculate available height for the list (fallback to reasonable default)
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const usedHeight = TOOLBAR_HEIGHT + HEADER_HEIGHT + FIELD_HEADER_HEIGHT
  const listHeight = Math.max(400, viewportHeight - usedHeight)

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

  // Render study mode if active
  if (mode === 'study') {
    return (
      <StudyMode
        bundleIds={bundleIds}
        studyEngine={studyEngine}
        onEndStudy={handleEndStudy}
      />
    )
  }

  // Render browse mode (no notes loaded yet)
  if (!notes.length) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Toolbar shardId={shard.id} onBack={onBack} onToolSelect={handleToolSelect} />
        <Box sx={{ p: 4, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
          <Collections sx={{ fontSize: 48, color: 'neutral.400', mb: 2 }} />
          <Typography color="neutral">
            {bundleIds.length ? 'Loading notes...' : 'No notes found'}
          </Typography>
        </Box>
      </Box>
    )
  }

  // Render browse mode with notes
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Toolbar shardId={shard.id} onBack={onBack} onToolSelect={handleToolSelect} />

      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography level="title-lg" sx={{ mb: 0.5 }}>
          {shardData.name}
        </Typography>
        <Typography level="body-sm" color="neutral">
          {notes.length} notes
        </Typography>
      </Box>

      {/* Field headers */}
      <Box
        sx={{
          display: 'flex',
          p: 1.5,
          bgcolor: 'background.surface',
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        <Box sx={{ minWidth: 60, pr: 2, textAlign: 'center' }}>
          <Typography level="body-sm" fontWeight="bold">
            #
          </Typography>
        </Box>
        {fieldNames.map((fieldName) => (
          <Box key={fieldName} sx={{ flex: 1, pr: 2, minWidth: 0 }}>
            <Typography level="body-sm" fontWeight="bold">
              {fieldName}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Virtual scrolled notes */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <List
          height={listHeight}
          itemCount={notes.length}
          itemSize={ITEM_HEIGHT}
        >
          {renderNote}
        </List>
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
