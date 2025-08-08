import { useEffect, useState } from 'react'
import { Box, Stack, Typography, CircularProgress } from '@mui/joy'
import { apiCall } from '../config/api.js'
import { log } from '../utils/logger'

export const DictCollins = ({ word, visible }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!visible || !word) {
      setData(null)
      setError(null)
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await apiCall(`/api/dict/lookup?word=${encodeURIComponent(word)}&dict=collins`)
        setData(result)
      } catch (e) {
        log.error('Collins fetch failed:', e)
        setError('Failed to load definition')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [word, visible])

  const collinsSx = {
    fontFamily: 'var(--joy-fontFamily-body)',
    lineHeight: 'var(--joy-lineHeight-md)',
    '& *': { fontFamily: 'inherit', color: 'var(--joy-palette-neutral-500)' },
    '& .caption': {
      // Use Joy surface token for subtle, theme-aware bg
      backgroundColor: 'var(--joy-palette-background-level1)',
      // color: 'var(--joy-palette-neutral-500)',
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
      marginLeft: '15px'
    },
    '& li': {
      margin: '5px 0',
      padding: '5px'
    },
    '& li.en_tip': {
      backgroundColor: 'var(--joy-palette-warning-100)',
      borderRadius: '5px'
    },
    '& ul.vli': {
      margin: 0,
      padding: 0
    }
  }

  if (loading) {
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
  )}

export default DictCollins


