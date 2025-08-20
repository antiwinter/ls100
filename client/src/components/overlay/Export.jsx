import { Stack, Typography, Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy'
import { InsertDriveFile } from '@mui/icons-material'
import { generateEudicXML, downloadFileEnhanced, generateFilename, isMobile } from '../../utils/exporters.js'

import { log } from '../../utils/logger.js'
import { useSessionStore } from './stores/useSessionStore.js'

export const ExportContent = ({ shardId }) => {
  // Get session store data
  const sessionStore = useSessionStore(shardId)
  const { wordlist, shardName } = sessionStore()

  log.debug('ExportContent re-render', { shardId, wordlist, shardName })

  const handleEudicExport = async () => {
    if (!wordlist.length) {
      log.warn('No words selected for export')
      return
    }

    try {
      log.debug(`Exporting ${wordlist.length} words to Eudic`)

      const xmlContent = generateEudicXML(wordlist, shardName)
      const filename = generateFilename(shardName, 'wordbook.xml')

      // Use enhanced download with mobile Eudic detection
      const result = await downloadFileEnhanced(xmlContent, filename, 'text/xml', {
        tryEudic: isMobile()
      })

      if (result.success) {
        log.debug(`Export completed via ${result.method}`)
      } else {
        log.error('Export failed:', result.error)
      }
    } catch (error) {
      log.error('Failed to export to Eudic:', error)
    }
  }

  const wordCount = wordlist.length

  return (
    <>
      <Box sx={{ px: 1, pb: 1 }}>
        {/* Title Section */}
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography level="title-md" sx={{ fontWeight: 600 }}>
            {shardName}
          </Typography>
          <Typography level="body-sm" color="neutral">
            {wordCount} word{wordCount !== 1 ? 's' : ''} selected
          </Typography>
        </Stack>

        {/* Action List */}
        <List sx={{ '--List-gap': '0px' }}>
          <ListItem>
            <ListItemButton
              onClick={wordCount > 0 ? handleEudicExport : undefined}
              disabled={wordCount === 0}
            >
              <ListItemDecorator>
                <InsertDriveFile />
              </ListItemDecorator>
              <ListItemContent>Save to Files (Eudic)</ListItemContent>
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </>
  )
}




