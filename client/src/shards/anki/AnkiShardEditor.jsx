import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent
} from '@mui/joy'
import { Close, Upload, Collections } from '@mui/icons-material'
import { parseAnkiFile } from './AnkiShard.js'
import { deckStorage } from './storage/storageManager.js'
import { log } from '../../utils/logger'

const DeckCard = ({ deck, onDelete }) => (
  <Card variant="outlined" sx={{ position: 'relative' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Collections color="primary" />
        <Typography level="title-md" sx={{ flex: 1 }}>
          {deck.name}
        </Typography>
        <IconButton
          size="sm"
          variant="plain"
          color="danger"
          onClick={onDelete}
          sx={{ '&:hover': { bgcolor: 'danger.100' } }}
        >
          <Close />
        </IconButton>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Chip size="sm" variant="soft" color="primary">
          {deck.totalCards} cards
        </Chip>
        {deck.studiedCards > 0 && (
          <Chip size="sm" variant="soft" color="success">
            {deck.studiedCards} studied
          </Chip>
        )}
      </Stack>

      {deck.lastStudied && (
        <Typography level="body-xs" color="neutral">
          Last studied: {new Date(deck.lastStudied).toLocaleDateString()}
        </Typography>
      )}
    </CardContent>
  </Card>
)

const UploadArea = ({ onFileSelect, loading }) => {
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files)
    const ankiFile = files.find(file => file.name.toLowerCase().endsWith('.apkg'))

    if (ankiFile) {
      onFileSelect(ankiFile)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
    // Clear input to allow selecting same file again
    e.target.value = ''
  }

  return (
    <Box
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        border: '2px dashed',
        borderColor: 'neutral.300',
        borderRadius: 'md',
        p: 3,
        textAlign: 'center',
        cursor: loading ? 'default' : 'pointer',
        bgcolor: 'background.level1',
        transition: 'all 0.2s',
        '&:hover': loading ? {} : {
          borderColor: 'primary.400',
          bgcolor: 'primary.50'
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".apkg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={loading}
      />

      {loading ? (
        <Stack spacing={2} alignItems="center">
          <CircularProgress size="lg" />
          <Typography color="neutral">Processing deck...</Typography>
        </Stack>
      ) : (
        <Stack spacing={2} alignItems="center">
          <Upload sx={{ fontSize: '2rem', color: 'neutral.500' }} />
          <div>
            <Typography level="title-md" color="neutral">
              Drop .apkg file here or click to browse
            </Typography>
            <Typography level="body-sm" color="neutral">
              Import Anki deck files
            </Typography>
          </div>
        </Stack>
      )}
    </Box>
  )
}

export const AnkiShardEditor = ({
  mode = 'create',
  shardData = null,
  detectedInfo = null,
  onChange
}) => {
  const [decks, setDecks] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const importedFilesRef = useRef(new Set())

  // Generate consistent temporary shard ID for create mode
  const tempShardId = useRef(null)

  const getShardId = useCallback(() => {
    // In edit mode, use the actual shard ID
    if (mode === 'edit' && shardData?.id) {
      return shardData.id
    }

    // In create mode, generate and reuse a consistent temporary ID
    if (!tempShardId.current) {
      tempShardId.current = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    return tempShardId.current
  }, [mode, shardData?.id])

  // Define handleFileImport BEFORE useEffect that uses it
  const handleFileImport = useCallback(async (file, filename) => {
    // Prevent importing the same file multiple times
    const fileKey = `${filename}_${file.size || 0}`
    if (importedFilesRef.current.has(fileKey)) {
      log.debug('File already imported, skipping:', filename)
      return
    }

    setLoading(true)
    setError(null)

    try {
      log.info('Importing Anki deck:', filename)
      importedFilesRef.current.add(fileKey)

      // Generate deck ID and import using new note+template structure
      const deckId = `deck-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
      const shardId = getShardId()

      const importResult = await parseAnkiFile(file, filename, deckId, shardId)

      // Update local state with new deck
      const updatedDecks = {
        ...decks,
        [deckId]: {
          id: deckId,
          name: importResult.name,
          totalCards: importResult.stats.cards,
          studiedCards: 0,
          lastStudied: null
        }
      }

      setDecks(updatedDecks)

      // Notify parent component
      onChange?.({
        deckIds: Object.keys(updatedDecks)
      })

      log.info('Anki file imported successfully:', importResult.name, `(${importResult.stats.cards} cards from ${importResult.stats.notes} notes)`)

    } catch (err) {
      log.error('Failed to import deck:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [decks, onChange, getShardId])

  // Initialize decks from storage or detected file
  useEffect(() => {
    if (mode === 'edit' && shardData?.data?.deckIds) {
      // Edit mode: load deck references for this shard only
      const deckList = {}
      const storedDecks = deckStorage.listDecksByShardId(getShardId())

      shardData.data.deckIds.forEach(deckId => {
        if (storedDecks[deckId]) {
          deckList[deckId] = storedDecks[deckId]
        }
      })

      setDecks(deckList)
      onChange?.({ deckIds: Object.keys(deckList) })
    } else if (mode === 'create' && detectedInfo?.metadata?.file) {
      // Create mode with detected .apkg file
      handleFileImport(detectedInfo.metadata.file, detectedInfo.filename)
    } else {
      // Load existing decks for this shard only
      setDecks(deckStorage.listDecksByShardId(getShardId()))
    }
  }, [mode, shardData, detectedInfo, onChange]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: handleFileImport excluded to prevent infinite loop
  // (it updates decks which recreates itself)

  const handleFileSelect = async (file) => {
    await handleFileImport(file, file.name)
  }

  const handleDeckDelete = async (deckId) => {
    try {
      await deckStorage.deleteDeck(deckId)

      const updatedDecks = { ...decks }
      delete updatedDecks[deckId]

      setDecks(updatedDecks)
      onChange?.({
        deckIds: Object.keys(updatedDecks)
      })

      log.info('Deck deleted:', deckId)

    } catch (err) {
      log.error('Failed to delete deck:', err)
      setError('Failed to delete deck')
    }
  }

  const deckList = Object.entries(decks)
  const totalCards = deckList.reduce((sum, [, deck]) => sum + deck.totalCards, 0)

  return (
    <Stack spacing={3}>
      <Box>
        <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
          Anki Decks
        </Typography>

        {error && (
          <Alert color="danger" sx={{ mb: 2 }}>
            <Typography level="body-sm">{error}</Typography>
          </Alert>
        )}

        {deckList.length > 0 && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {deckList.map(([deckId, deck]) => (
              <DeckCard
                key={deckId}
                deck={deck}
                onDelete={() => handleDeckDelete(deckId)}
              />
            ))}
          </Stack>
        )}

        <UploadArea onFileSelect={handleFileSelect} loading={loading} />

        {deckList.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.level1', borderRadius: 'md' }}>
            <Typography level="body-sm" color="neutral">
              Total: {deckList.length} deck{deckList.length !== 1 ? 's' : ''} • {totalCards} cards
            </Typography>
          </Box>
        )}

        <Typography level="body-xs" sx={{ mt: 1, color: 'text.tertiary' }}>
          Import .apkg files exported from Anki. Decks are stored locally in your browser.
        </Typography>
      </Box>

      <Box>
        <Typography level="body-sm" sx={{ mb: 2, color: 'primary.500', fontWeight: 'bold' }}>
          Study Settings
        </Typography>

        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="body-sm" color="neutral">
              New cards per day
            </Typography>
            <Typography level="body-sm" color="primary">
              20 (default)
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="body-sm" color="neutral">
              Review cards per day
            </Typography>
            <Typography level="body-sm" color="primary">
              200 (default)
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="body-sm" color="neutral">
              Spaced repetition algorithm
            </Typography>
            <Chip size="sm" variant="soft" color="success">
              FSRS (Modern)
            </Chip>
          </Box>
        </Stack>
      </Box>
    </Stack>
  )
}
