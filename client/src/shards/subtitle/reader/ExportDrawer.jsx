import { useState } from 'react'
import { Stack, Typography, Input, Button } from '@mui/joy'
import { BookmarkAdd, InsertDriveFile } from '@mui/icons-material'
import { MenuDrawer } from '../../../components/MenuDrawer.jsx'
import { AppDialog } from '../../../components/AppDialog.jsx'
import { generateEudicXML, downloadFileEnhanced, generateFilename, isMobile } from '../../../utils/exporters'

import { apiCall } from '../../../config/api'
import { log } from '../../../utils/logger'

export const ExportDrawer = ({
  open,
  onClose,
  selectedWords = [],
  movieName = '',
  shardId,
  currentLine = 0,
  lines = []
}) => {
  const [showBookmarkModal, setShowBookmarkModal] = useState(false)
  const [bookmarkNote, setBookmarkNote] = useState('')

  // Generate default bookmark note
  const getDefaultNote = () => {
    const currentLineIndex = currentLine - 1
    const lineContent = lines[currentLineIndex]?.data?.text || lines[currentLineIndex]?.text || ''
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
    return `${timestamp} - ${lineContent.substring(0, 50)}${lineContent.length > 50 ? '...' : ''}`
  }

  const handleBookmarkClick = async () => {
    setBookmarkNote(getDefaultNote())
    setShowBookmarkModal(true)
  }

  const handleBookmarkSave = async () => {
    try {
      log.debug(`Adding bookmark at position ${currentLine}`)

      const bookmark = {
        position: currentLine,
        note: bookmarkNote.trim()
      }

      await apiCall(`/api/subtitle-shards/${shardId}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify(bookmark)
      })

      log.debug('Bookmark added successfully')
      setShowBookmarkModal(false)
      onClose()
    } catch (error) {
      log.error('Failed to add bookmark:', error)
    }
  }

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

  const menuEntries = [
    {
      entryName: 'Add to Bookmark',
      icon: <BookmarkAdd />,
      action: handleBookmarkClick
    },
    {
      entryName: 'Save to Files (Eudic)',
      icon: <InsertDriveFile />,
      action: wordCount > 0 ? handleEudicExport : null
    }
  ]

  const titleComponent = (
    <Stack spacing={0.5}>
      <Typography level="title-md" sx={{ fontWeight: 600 }}>
        {movieName}
      </Typography>
      <Typography level="body-sm" color="neutral">
        {wordCount} word{wordCount !== 1 ? 's' : ''} selected
      </Typography>
    </Stack>
  )

  return (
    <>
      <MenuDrawer
        open={open}
        onClose={onClose}
        title={titleComponent}
        entries={menuEntries}
      />

      {/* Bookmark Note Modal */}
      <AppDialog
        open={showBookmarkModal}
        onClose={() => setShowBookmarkModal(false)}
        title="Add Bookmark"
        maxWidth={400}
      >
        <Stack spacing={2}>
          <Typography level="body-sm" color="neutral">
            Note for position {currentLine}:
          </Typography>

          <Input
            placeholder="Enter bookmark note..."
            value={bookmarkNote}
            onChange={(e) => setBookmarkNote(e.target.value)}
            autoFocus
            sx={{ fontSize: '14px' }}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setShowBookmarkModal(false)}
              sx={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={handleBookmarkSave}
              disabled={!bookmarkNote.trim()}
              sx={{ flex: 1 }}
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </AppDialog>
    </>
  )
}


