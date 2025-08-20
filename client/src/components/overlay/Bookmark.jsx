import { useState } from 'react'
import { Stack, Typography, Input, Button, Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy'
import { BookmarkAdd } from '@mui/icons-material'
import { AppDialog } from '../AppDialog.jsx'

import { apiCall } from '../../config/api.js'
import { log } from '../../utils/logger.js'

export const BookmarkContent = ({
  movieName, shardId, currentLine, lines, onClose
}) => {
  const [showBookmarkModal, setShowBookmarkModal] = useState(false)
  const [bookmarkNote, setBookmarkNote] = useState('')

  log.debug('BookmarkContent re-render', { movieName, shardId, currentLine, lines })

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

  return (
    <>
      <Box sx={{ px: 1, pb: 1 }}>
        {/* Title Section */}
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography level="title-md" sx={{ fontWeight: 600 }}>
            {movieName}
          </Typography>
          <Typography level="body-sm" color="neutral">
            Add bookmark at line {currentLine}
          </Typography>
        </Stack>

        {/* Action List */}
        <List sx={{ '--List-gap': '0px' }}>
          <ListItem>
            <ListItemButton onClick={handleBookmarkClick}>
              <ListItemDecorator>
                <BookmarkAdd />
              </ListItemDecorator>
              <ListItemContent>Add to Bookmark</ListItemContent>
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

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
