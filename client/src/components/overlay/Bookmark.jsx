import { useState, useEffect } from 'react'
import { Stack, Typography, Button, Box } from '@mui/joy'
import { BookmarkAdd, BookmarkBorder } from '@mui/icons-material'
import { PrettoSlider } from '../Keyparts'
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
import { formatSec, formatRelativeTime } from '../../utils/dateFormat.js'

export const BookmarkContent = ({ shardId, onSeek }) => {
  const {
    position, hint, shardName, bookmarks, totalGroups, addBookmark, removeBookmark
  } = useSessionStore(shardId)()

  const [seek, setSeek] = useState(position || 0)

  log.debug('BookmarkContent re-render', { shardId, position, hint, shardName, bookmarksCount: bookmarks.length })

  // Only initialize seek from position once on mount, not on every position change
  // This prevents circular dependency: position -> seek -> onSeek -> position
  useEffect(() => {
    setSeek(position || 0)
  }, [shardId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally NOT including 'position' to break circular dependency

  const existing = bookmarks.find(b => b.gid === hint?.gid)
  const hasBookmark = !!existing

  const onBookmark = () => {
    try {
      log.debug('Adding bookmark', { gid: hint?.gid, sec: hint?.sec, line: hint?.line })
      addBookmark({
        gid: hint?.gid || position,
        sec: hint?.sec || 0,
        line: hint?.line || 'Bookmark'
      })
    } catch (error) {
      log.error('Failed to add bookmark', error)
    }
  }

  const goTo = (bookmark) => {
    log.debug('Go to bookmark', { gid: bookmark.gid })
    onSeek?.(bookmark.gid)
  }

  const deleteBookmark = (bookmark) => {
    log.debug('Delete bookmark', { gid: bookmark.gid })
    removeBookmark(bookmark.gid)
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
        key={bookmark.gid}
        trailingActions={actions()}
        onClick={() => goTo(bookmark)}
      >
        <Box sx={{
          p: 1,
          bgcolor: 'background.surface',
          borderRadius: 'sm',
          mb: 1,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <Stack spacing={0.5} sx={{ width: '100%', minWidth: 0 }}>
            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ width: '100%' }}>
              <Stack direction='row' alignItems='center' spacing={0.5}>
                <BookmarkBorder sx={{ fontSize: '0.8rem', color: 'neutral.400' }} />
                <Typography
                  level='body-xs'
                  sx={{
                    color: 'neutral.400',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem'
                  }}
                >
                  {bookmark.gid + 1} - {formatSec(bookmark.sec || 0)}
                </Typography>
              </Stack>
              <Typography
                level='body-xs'
                sx={{
                  color: 'neutral.400',
                  fontSize: '0.7rem'
                }}
              >
                {formatRelativeTime(bookmark.timestamp)}
              </Typography>
            </Stack>
            <Typography
              level='body-md'
              sx={{
                color: 'neutral.500',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                maxWidth: '100%'
              }}
            >
              {bookmark.line || 'Bookmark'}
            </Typography>
          </Stack>
        </Box>
      </SwipeableListItem>
    )
  }

  return (
    <>
      <Stack sx={{ height: '100%' }}>
        <Box sx={{ px: 1, flex: 1, overflow: 'auto', width: '100%', maxWidth: '100%' }}>
          {/* Seek Bar */}
          {totalGroups > 0 && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography level='title-sm' sx={{ color: 'neutral.500' }}>
                  Position
                </Typography>
              </Stack>
              <div data-allow-events="true">
                <PrettoSlider
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
                  valueLabelFormat={(value) => `#${value + 1}`}
                />
              </div>
            </Stack>
          )}

          {/* Bookmarks Section */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2, mb: 1 }}>
            <Typography level='title-sm' sx={{ color: 'neutral.500' }}>
              Bookmarks ({bookmarks.length})
            </Typography>
            <Button
              startDecorator={<BookmarkAdd />}
              onClick={hasBookmark ? undefined : onBookmark}
              disabled={hasBookmark}
              variant="plain"
              size="sm"
              sx={{
                fontSize: 'sm',
                fontWeight: 'normal',
                minHeight: 'auto',
                p: 0.5,
                opacity: hasBookmark ? 0.5 : 1,
                '&:hover': {
                  bgcolor: 'transparent'
                },
                '&:active': {
                  bgcolor: 'transparent'
                }
              }}
            >
              Add to bookmark
            </Button>
          </Stack>

          {/* Existing Bookmarks */}
          {bookmarks.length > 0 ? (
            <Box sx={{ width: '100%', overflow: 'hidden' }}>
              <SwipeableList type={SwipeType.IOS} fullSwipe={true} threshold={0.7}>
                {[...bookmarks].sort((a, b) => b.gid - a.gid).map(renderBookmarkItem)}
              </SwipeableList>
            </Box>
          ) : (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography level="body-sm" color="neutral">
                No bookmarks yet
              </Typography>
              <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                Add your first bookmark using the button above
              </Typography>
            </Box>
          )}
        </Box>
      </Stack>
    </>
  )
}
