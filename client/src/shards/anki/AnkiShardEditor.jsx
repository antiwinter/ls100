import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent
} from '@mui/joy'
import { Upload } from '@mui/icons-material'
import { parseApkgFile } from './parser/apkgParser.js'
import { queueImport } from './AnkiShard.js'
import { log } from '../../utils/logger'

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
  shardData: _shardData = null,
  detectedInfo = null,
  onChange
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFileImport = useCallback(async (file, filename) => {
    setLoading(true)
    setError(null)

    try {
      log.info('Queuing Anki import:', filename)

      // Parse and queue - no IDB writes until Save
      const parsed = await parseApkgFile(file)
      queueImport(parsed, filename)

      // Store deck info in onChange for parent component
      const deckInfo = {
        id: `deck-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        name: parsed.name,
        filename,
        totalCards: parsed.cards?.length || 0,
        isPending: true
      }

      onChange?.({
        deckInfo,
        action: 'add'
      })

      log.info('Anki import queued:', parsed.name)

    } catch (err) {
      log.error('Failed to queue import:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onChange])

  useEffect(() => {
    if (mode === 'create' && detectedInfo?.metadata?.file) {
      // Queue detected file for import
      handleFileImport(detectedInfo.metadata.file, detectedInfo.filename)
    }
  }, [mode, detectedInfo, handleFileImport])

  const handleFileSelect = async (file) => {
    await handleFileImport(file, file.name)
  }



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



        <UploadArea onFileSelect={handleFileSelect} loading={loading} />



        <Typography level="body-xs" sx={{ mt: 1, color: 'text.tertiary' }}>
          Import .apkg files exported from Anki. Files will be processed when you save the shard.
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
