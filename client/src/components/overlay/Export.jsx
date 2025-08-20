import { Stack, Typography, Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy'
import { InsertDriveFile } from '@mui/icons-material'
import { generateEudicXML, downloadFileEnhanced, generateFilename, isMobile } from '../../utils/exporters.js'

import { log } from '../../utils/logger.js'

export const ExportContent = ({
  selectedWords, movieName, onClose
}) => {
  log.debug('ExportContent re-render', { selectedWords, movieName })

  const handleEudicExport = async () => {
    if (!selectedWords.length) {
      log.warn('No words selected for export')
      return
    }

    try {
      log.debug(`Exporting ${selectedWords.length} words to Eudic`)

      const xmlContent = generateEudicXML(selectedWords, movieName)
      const filename = generateFilename(movieName, 'wordbook.xml')

      // Use enhanced download with mobile Eudic detection
      const result = await downloadFileEnhanced(xmlContent, filename, 'text/xml', {
        tryEudic: isMobile()
      })

      if (result.success) {
        log.debug(`Export completed via ${result.method}`)
      } else {
        log.error('Export failed:', result.error)
      }

      onClose()
    } catch (error) {
      log.error('Failed to export to Eudic:', error)
    }
  }

  const wordCount = selectedWords.length

  return (
    <>
      <Box sx={{ px: 1, pb: 1 }}>
        {/* Title Section */}
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography level="title-md" sx={{ fontWeight: 600 }}>
            {movieName}
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




