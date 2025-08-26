import { useState, useCallback, useEffect } from 'react'
import { Stack, Typography, Input, Button, Box, List, ListItem, ListItemButton, ListItemDecorator, ListItemContent, Slider } from '@mui/joy'
import { BookmarkAdd } from '@mui/icons-material'
import { AppDialog } from '../AppDialog.jsx'
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type as SwipeType
} from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'

import { log } from '../../utils/logger'
import { useSessionStore } from './stores/useSessionStore.js'
import { formatRelativeTime } from '../../utils/dateFormat.js'

export const BookmarkContent = ({ shardId, onSeek }) => {
  const [showModal, setShowModal] = useState(false)
  const [note, setNote] = useState('')
  const [seek, setSeek] = useState(0)

  const {
    position, hint, shardName, bookmarks, totalGroups, addBookmark, removeBookmark
  } = useSessionStore(shardId)()

  log.debug('BookmarkContent re-render', { shardId, position, hint, shardName, bookmarksCount: bookmarks.length })

  useEffect(() => {
    setSeek(position || 0)
  }, [position])

  const existing = bookmarks.find(b => b.position === position)
  const hasBookmark = !!existing

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
      log.debug('Adding bookmark', { position, note: note.trim() })
      addBookmark({ position, note: note.trim() })
      setShowModal(false)
    } catch (error) {
      log.error('Failed to add bookmark', error)
    }
  }

  const goTo = (bookmark) => {
    log.debug('Go to bookmark', { id: bookmark.id, position: bookmark.position })
    onSeek?.(bookmark.position)
  }

  const deleteBookmark = (bookmark) => {
    log.debug('Delete bookmark', { id: bookmark.id, position: bookmark.position })
    removeBookmark(bookmark.id)
  }

  const renderBookmarkItem = (bookmark) => {
    const actions = () => (
      <TrailingActions>
        <SwipeAction destructive={true} onClick={() => deleteBookmark(bookmark)}>
          <Box sx={{
            bgcolor: 'danger.400',
            color: 'white',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
            fontFamily: 'var(--joy-fontFamily-body)',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: 'sm'
          }}>
            Delete
          </Box>
        </SwipeAction>
      </TrailingActions>
    )

    return (
      <SwipeableListItem
        key={bookmark.id}
        trailingActions={actions()}
        onClick={() => goTo(bookmark)}
      >
        <Box sx={{ p: 2, bgcolor: 'background.surface', borderRadius: 'sm', mb: 1 }}>
          <Stack spacing={0.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="body-sm" color="neutral">
                Line {bookmark.position}
              </Typography>
              <Typography level="body-xs" color="neutral">
                {formatRelativeTime(bookmark.timestamp)}
              </Typography>
            </Stack>
            <Typography level="body-sm" sx={{ fontWeight: 500 }}>
              {bookmark.note || 'Bookmark'}
            </Typography>
          </Stack>
        </Box>
      </SwipeableListItem>
    )
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
            {hasBookmark ?
              `Bookmark exists at line: ${position}` :
              `Add bookmark to line: ${position}`
            }
          </Typography>
        </Stack>

        {/* Seek Bar */}
        {totalGroups > 0 && (
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="body-sm" color="neutral">
                Position
              </Typography>
              <Typography level="body-sm" color="primary">
                {seek + 1} / {totalGroups}
              </Typography>
            </Stack>
            <div data-allow-events="true">
              <Slider
                value={seek}
                onChange={(_, value) => setSeek(value)}
                onChangeCommitted={(_, value) => {
                  log.debug('Seeking to position', { value })
                  onSeek?.(value)
                }}
                min={0}
                max={totalGroups - 1}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `Line ${value + 1}`}
                sx={{
                  '& .MuiSlider-thumb': {
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: '0 0 0 8px rgba(var(--joy-palette-primary-mainChannel) / 0.16)'
                    }
                  }
                }}
              />
            </div>
          </Stack>
        )}

        {/* Action List */}
        <List sx={{ '--List-gap': '0px' }}>
          <ListItem>
            <ListItemButton
              onClick={hasBookmark ? undefined : onBookmark}
              disabled={hasBookmark}
              sx={{
                opacity: hasBookmark ? 0.5 : 1,
                cursor: hasBookmark ? 'default' : 'pointer'
              }}
            >
              <ListItemDecorator>
                <BookmarkAdd />
              </ListItemDecorator>
              <ListItemContent>
                {hasBookmark ? 'Bookmark Already Exists' : 'Add to Bookmark'}
              </ListItemContent>
            </ListItemButton>
          </ListItem>
        </List>

        {/* Show existing bookmark at current position */}
        {hasBookmark && (
          <Box sx={{ mt: 2, px: 1, py: 1, bgcolor: 'warning.softBg', borderRadius: 'sm' }}>
            <Typography level="body-xs" color="warning" sx={{ fontWeight: 600, mb: 0.5 }}>
              Existing bookmark at this position:
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 500 }}>
              "{existing.note || 'Bookmark'}"
            </Typography>
            <Typography level="body-xs" color="neutral">
              Created {formatRelativeTime(existing.timestamp)}
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
              <SwipeableList type={SwipeType.IOS} fullSwipe={true} threshold={0.7}>
                {[...bookmarks].sort((a, b) => a.position - b.position).map(renderBookmarkItem)}
              </SwipeableList>
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
