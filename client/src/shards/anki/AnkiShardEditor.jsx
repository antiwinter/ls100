import { useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  Stack,
  Chip
} from '@mui/joy'
import { log } from '../../utils/logger'
import { genId } from '../../utils/idGenerator.js'

export const AnkiShardEditor = ({
  mode = 'create',
  shard = null,
  detectedInfo = null,
  onMetaChange,
  onDataChange
}) => {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return

    if (mode === 'edit' && shard?.meta?.bundles) {
      return // In edit mode, just render - don't call callbacks
    }

    if (!detectedInfo) return

    const filename = detectedInfo.filename || 'unknown.apkg'
    const parsed = detectedInfo.metadata?.parsedData

    if (!parsed) {
      log.error('No parsed data in detectedInfo')
      return
    }

    const bundleId = genId('bundle', filename + (parsed.deckName || parsed.name || ''))

    onMetaChange?.({
      bundles: [{
        id: bundleId,
        name: parsed.deckName || parsed.name,
        filename
      }]
    })

    onDataChange?.({
      bundles: [{
        ...parsed,
        bundleId,
        filename,
        name: parsed.deckName || parsed.name
      }]
    })

    log.info('Anki import initialized:', parsed.name)
    initialized.current = true
  }, [mode, shard, detectedInfo, onMetaChange, onDataChange])

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
