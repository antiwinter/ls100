import { useState, useCallback } from 'react'
import { Stack, Typography, Input, Button, Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent } from '@mui/joy'
import { BookmarkAdd } from '@mui/icons-material'
import { AppDialog } from '../AppDialog.jsx'

import { log } from '../../utils/logger.js'
import { useSessionStore } from './stores/useSessionStore.js'
import { SwipeableButton2 as SwipeableButton } from '../SwipeableButton2.jsx'

export const BookmarkContent = ({ shardId }) => {
  const [showModal, setShowModal] = useState(false)
  const [note, setNote] = useState('')

  const {
    position, hint, shardName, bookmarks, addBookmark, removeBookmark
  } = useSessionStore(shardId)()

  log.debug('BookmarkContent re-render', { shardId, position, hint, shardName, bookmarks })

  // Check if bookmark already exists at current position
  const existingBookmark = bookmarks.find(b => b.position === position)
  const hasBookmarkAtPosition = !!existingBookmark

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

  const onSave = () => {
    try {
      log.debug('Adding bookmark', { position })

      addBookmark({
        position,
        note: note.trim()
      })

      log.debug('Bookmark added to sessionStore')
      setShowModal(false)
    } catch (error) {
      log.error('Failed to add bookmark', error)
    }
  }

  // Bookmark action handlers
  const handleGoToBookmark = (bookmark) => {
    log.debug('Go to bookmark', { bookmark })
    // TODO: Implement seek functionality
  }

  const handleEditBookmark = (bookmark) => {
    log.debug('Edit bookmark', { bookmark })
    // TODO: Implement edit functionality
  }

  const handleDeleteBookmark = (bookmark) => {
    log.debug('Delete bookmark', { bookmark })
    removeBookmark(bookmark.id)
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
            {hasBookmarkAtPosition ?
              `Bookmark exists at line: ${position}` :
              `Add bookmark to line: ${position}`
            }
          </Typography>
        </Stack>

        {/* Action List */}
        <List sx={{ '--List-gap': '0px' }}>
          <ListItem>
            <ListItemButton
              onClick={hasBookmarkAtPosition ? undefined : onBookmark}
              disabled={hasBookmarkAtPosition}
              sx={{
                opacity: hasBookmarkAtPosition ? 0.5 : 1,
                cursor: hasBookmarkAtPosition ? 'default' : 'pointer'
              }}
            >
              <ListItemDecorator>
                <BookmarkAdd />
              </ListItemDecorator>
              <ListItemContent>
                {hasBookmarkAtPosition ? 'Bookmark Already Exists' : 'Add to Bookmark'}
              </ListItemContent>
            </ListItemButton>
          </ListItem>
        </List>

        {/* Show existing bookmark at current position */}
        {hasBookmarkAtPosition && (
          <Box sx={{ mt: 2, px: 1, py: 1, bgcolor: 'warning.softBg', borderRadius: 'sm' }}>
            <Typography level="body-xs" color="warning" sx={{ fontWeight: 600, mb: 0.5 }}>
              Existing bookmark at this position:
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 500 }}>
              "{existingBookmark.note || 'Bookmark'}"
            </Typography>
            <Typography level="body-xs" color="neutral">
              Created {new Date(existingBookmark.timestamp).toLocaleDateString()}
            </Typography>
          </Box>
        )}

        {/* Existing Bookmarks */}
        {bookmarks.length > 0 ? (
          <>
            <Typography level="title-sm" sx={{ mt: 2, mb: 1, px: 1, color: 'text.secondary' }}>
              Bookmarks ({bookmarks.length})
            </Typography>
            <Box sx={{ px: 1 }}>
              <Stack spacing={1}>
                {[...bookmarks]
                  .sort((a, b) => a.position - b.position)
                  .map(bookmark => (
                    <SwipeableButton
                      key={bookmark.id}
                      actions={[
                        {
                          name: 'Delete',
                          color: 'danger',
                          action: () => handleDeleteBookmark(bookmark)
                        },
                        {
                          name: 'Edit',
                          color: 'neutral',
                          action: () => handleEditBookmark(bookmark)
                        },
                        {
                          name: 'Go',
                          color: 'warning',
                          action: () => handleGoToBookmark(bookmark)
                        }
                      ]}
                      onClick={() => handleGoToBookmark(bookmark)}
                    >
                      <Stack spacing={0.5}>
                        {bookmark.position}
                        <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                          {bookmark.note || 'Bookmark'}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          Created {new Date(bookmark.timestamp).toLocaleDateString()}
                        </Typography>
                      </Stack>
                    </SwipeableButton>
                  ))}
              </Stack>
            </Box>
          </>
        ) : (
          <Box sx={{ mt: 2, px: 1, py: 2, textAlign: 'center' }}>
            <Typography level="body-sm" color="neutral">
              No bookmarks yet
            </Typography>
            <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
              Add your first bookmark using the button above
            </Typography>
          </Box>
        )}
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
            Note for {position}:
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
