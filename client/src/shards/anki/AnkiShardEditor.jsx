import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Stack,
  Chip,
  CircularProgress,
  Alert
} from '@mui/joy'
import { Upload } from '@mui/icons-material'
import { parseApkgFile } from './parser/apkgParser.js'
import { log } from '../../utils/logger'
import { genId } from '../../utils/idGenerator.js'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const processedDetectedFile = useRef(null)

  const handleFileSelect = useCallback(async (file, filename, parsedData = null) => {
    setLoading(true)
    setError(null)

    try {
      log.info('Processing Anki file:', filename, parsedData ? '(using cached data)' : '(parsing)')

      const parsed = parsedData || await parseApkgFile(file)
      const deckId = await genId('deck', filename + parsed.name)

      // Store parsed data directly in shardData.data
      const currentDataDecks = shardData?.data?.decks || []
      const updatedData = {
        ...shardData?.data,
        decks: [...currentDataDecks, { ...parsed, deckId, filename }]
      }

      // Store deck metadata  
      const deckInfo = {
        id: deckId,
        name: parsed.name,
        filename,
        totalCards: parsed.cards?.length || 0
      }
      const currentMetaDecks = shardData?.metadata?.decks || []
      const updatedMetadata = {
        ...shardData?.metadata,
        decks: [...currentMetaDecks, deckInfo]
      }

      // Update both data and metadata
      onChange?.(updatedData, 'data')
      onChange?.(updatedMetadata, 'meta')

      log.info('Anki import processed:', parsed.name)

    } catch (err) {
      log.error('Failed to process import:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onChange, shardData])

  useEffect(() => {
    if (mode === 'create' && detectedInfo?.file && detectedInfo.file !== processedDetectedFile.current) {
      processedDetectedFile.current = detectedInfo.file
      const filename = detectedInfo.filename || 'unknown.apkg'
      handleFileSelect(detectedInfo.file, filename, detectedInfo.metadata?.parsedData)
    }
  }, [mode, detectedInfo, handleFileSelect])

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

        <UploadArea onFileSelect={(file) => handleFileSelect(file, file.name, null)} loading={loading} />

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
