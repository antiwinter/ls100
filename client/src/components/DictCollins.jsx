import { useEffect, useState, useRef, memo } from 'react'
import { Box, Stack, Typography, CircularProgress } from '@mui/joy'
import { apiCall } from '../config/api.js'
import { log } from '../utils/logger'

const DictCollinsImpl = ({ word, onMeta }) => {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const lastPronRef = useRef('')
  const reqIdRef = useRef(0)

  // log.debug('DictCollins re-render', { word, onMeta })

  useEffect(() => {
    if (!word) {
      return
    }
    const myId = ++reqIdRef.current
    ;(async () => {
      try {
        setError(null)
        const result = await apiCall(`/api/dict/lookup?word=${encodeURIComponent(word)}&dict=collins`)
        // ignore outdated responses
        if (reqIdRef.current !== myId) return
        setData(result)
        const nextPron = result?.pronunciation || ''
        if (nextPron !== lastPronRef.current) {
          lastPronRef.current = nextPron
          onMeta?.({ pronunciation: nextPron })
        }
      } catch (e) {
        if (reqIdRef.current !== myId) return
        log.error('Collins fetch failed:', e)
        setError('Failed to load definition')
      }
    })()
  }, [word, onMeta])

  const collinsSx = {
    fontFamily: 'var(--joy-fontFamily-body)',
    lineHeight: 'var(--joy-lineHeight-md)',
    '& *': { fontFamily: 'inherit', color: 'var(--joy-palette-neutral-500)' },
    '& .caption': {
      // Use Joy surface token for subtle, theme-aware bg
      backgroundColor: 'var(--joy-palette-background-level1)',
      padding: '6px',
      borderRadius: '6px',
      margin: '10px 0 6px 0'
    },
    '& .num, & .st': {
      color: 'var(--joy-palette-secondary-400)',
      fontSize: '13px',
      fontWeight: 600,
      marginRight: '5px'
    },
    '& .text_blue': {
      color: 'var(--joy-palette-primary-600)',
      margin: '3px',
      fontWeight: 600
    },
    '& ul': {
      marginLeft: '25px',
      paddingLeft: '0'
    },
    '& li': {
      margin: '5px 0',
      padding: '5px',
      position: 'relative'
    },
    '& li.en_tip': {
      backgroundColor: 'var(--joy-palette-background-level1)',
      borderRadius: '5px',
      padding: '6px 10px'
    },
    '& li.en_tip ul, & ul.vli': {
      margin: '8px 0 0 20px',
      padding: 0
    }
  }

  if (!word) return null
  if (!data && !error) {
    return (
      <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
        <CircularProgress size="sm" />
        <Typography level="body-sm">Loading definition...</Typography>
      </Stack>
    )
  }

  if (error) {
    return (
      <Typography color="danger" level="body-sm">{error}</Typography>
    )
  }

  if (!data) return null

  return (
    <Stack spacing={2}>
      {data.found === false && (
        <Typography level="body-sm" color="neutral">
          No entry found. Try another word.
        </Typography>
      )}

      {data.definitionHtml && (
        <Box sx={collinsSx} dangerouslySetInnerHTML={{ __html: data.definitionHtml }} />
      )}
    </Stack>
  )
}

export const DictCollins = memo(DictCollinsImpl)
