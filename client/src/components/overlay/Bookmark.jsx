import { useState } from 'react'
import { Stack, Typography, Input, Button, Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy'
import { BookmarkAdd } from '@mui/icons-material'
import { AppDialog } from '../AppDialog.jsx'

import { apiCall } from '../../config/api.js'
import { log } from '../../utils/logger.js'
import { useSessionStore } from './stores/useSessionStore.js'

export const BookmarkContent = ({ shardId }) => {
  const [showBookmarkModal, setShowBookmarkModal] = useState(false)
  const [bookmarkNote, setBookmarkNote] = useState('')

  // Get session store data
  const sessionStore = useSessionStore(shardId)
  const { position, hint, shardName } = sessionStore()

  log.debug('BookmarkContent re-render', { shardId, position, hint, shardName })

  // Generate default bookmark note
  const getDefaultNote = () => {
    return hint || 'Bookmark'
  }

  const handleBookmarkClick = async () => {
    setBookmarkNote(getDefaultNote())
    setShowBookmarkModal(true)
  }

  const handleBookmarkSave = async () => {
    try {
      log.debug(`Adding bookmark at position ${position}`)

      const bookmark = {
        position: position,
        note: bookmarkNote.trim()
      }

      await apiCall(`/api/subtitle-shards/${shardId}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify(bookmark)
      })

      log.debug('Bookmark added successfully')
      setShowBookmarkModal(false)
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
            {shardName}
          </Typography>
          <Typography level="body-sm" color="neutral">
            Add bookmark at line {position}
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
            Note for position {position}:
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
