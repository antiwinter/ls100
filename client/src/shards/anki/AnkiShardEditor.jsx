import { useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Stack,
  Chip
} from '@mui/joy'
import { parseApkgFile } from './apkg/index.js'
import { log } from '../../utils/logger'
import { genId } from '../../utils/idGenerator.js'

export const AnkiShardEditor = ({
  mode = 'create',
  shardData = null,
  detectedInfo = null,
  onChange
}) => {
  const processedDetectedFile = useRef(null)

  const handleFileSelect = useCallback(async (file, filename, parsedData = null) => {
    try {
      log.info('Processing Anki file:', filename, parsedData ? '(using cached data)' : '(parsing)')

      const parsed = parsedData || await parseApkgFile(file)
      const bundleId = genId('bundle', filename + (parsed.deckName || parsed.name || ''))

      // Store parsed data directly in shardData.data
      const currentDataBundles = shardData?.data?.bundles || []
      const updatedData = {
        ...shardData?.data,
        bundles: [
          ...currentDataBundles,
          {
            ...parsed,
            bundleId,
            filename,
            name: parsed.deckName || parsed.name
          }
        ]
      }

      // Store bundle info in meta
      const bundleInfo = {
        id: bundleId,
        name: parsed.deckName || parsed.name,
        filename
      }
      const currentBundles = shardData?.meta?.bundles || []
      const updatedMeta = {
        ...shardData?.meta,
        bundles: [...currentBundles, bundleInfo]
      }

      // Update meta (merges data and metadata)
      onChange?.(updatedData)
      onChange?.(updatedMeta, true)

      log.info('Anki import processed:', parsed.name)

    } catch (err) {
      log.error('Failed to process import:', err)
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
