import { useState, useCallback } from 'react'
import { Stack, Typography, Input, Button, Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy'
import { BookmarkAdd } from '@mui/icons-material'
import { AppDialog } from '../AppDialog.jsx'

import { apiCall } from '../../config/api.js'
import { log } from '../../utils/logger.js'
import { formatSec } from '../../utils/dateFormat.js'
import { useSessionStore } from './stores/useSessionStore.js'

export const BookmarkContent = ({ shardId }) => {
  const [showModal, setShowModal] = useState(false)
  const [note, setNote] = useState('')

  const { position, hint, shardName } = useSessionStore(shardId)()

  log.debug('BookmarkContent re-render', { shardId, position, hint, shardName })

  // Ref callback to focus input and position cursor at beginning
  const inputRef = useCallback((el) => {
    if (!el) return

    const input = el.querySelector ? el.querySelector('input') : el
    if (input) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        input.focus()
        if (note && input.setSelectionRange) {
          input.setSelectionRange(0, note.length)
        }
      }, 50)
    }
  }, [note])

  const onBookmark = () => {
    setNote(hint || 'Bookmark')
    setShowModal(true)
  }

  const onSave = async () => {
    try {
      log.debug('Adding bookmark', { position })

      await apiCall(`/api/subtitle-shards/${shardId}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify({ position, note: note.trim() })
      })

      log.debug('Bookmark added')
      setShowModal(false)
    } catch (error) {
      log.error('Failed to add bookmark', error)
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
            Add bookmark at {formatSec(position)}
          </Typography>
        </Stack>

        {/* Action List */}
        <List sx={{ '--List-gap': '0px' }}>
          <ListItem>
            <ListItemButton onClick={onBookmark}>
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
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add Bookmark"
        maxWidth={400}
      >
        <Stack spacing={2}>
          <Typography level="body-sm" color="neutral">
            Note for {formatSec(position)}:
          </Typography>

          <Input
            ref={inputRef}
            placeholder="Enter bookmark note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            sx={{ fontSize: '14px' }}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setShowModal(false)}
              sx={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={onSave}
              disabled={!note.trim()}
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
