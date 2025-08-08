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
    '& .caption': {
      backgroundColor: '#e0eeff',
      padding: '5px',
      borderRadius: '5px',
      margin: '10px 0 5px 0'
    },
    '& .num, & .st': {
      fontSize: '11px',
      fontWeight: 600,
      marginRight: '5px'
    },
    '& .text_blue': {
      color: '#44a',
      margin: '3px',
      fontWeight: 600
    },
    '& ul': {
      marginLeft: '15px',
      color: '#686'
    },
    '& li': {
      margin: '5px 0',
      padding: '5px'
    },
    '& li.en_tip': {
      backgroundColor: '#ffc',
      borderRadius: '5px'
    },
    '& ul.vli': {
      margin: 0,
      padding: 0
    },
    '& a': { color: 'var(--joy-palette-primary-600, #0b6bcb)' }
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
      {data.definitionHtml && (
        <Box sx={collinsSx} dangerouslySetInnerHTML={{ __html: data.definitionHtml }} />
      )}

      {data.thesaurusHtml && (
        <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography level="title-sm" sx={{ mb: 1 }}>Thesaurus</Typography>
          <Box sx={collinsSx} dangerouslySetInnerHTML={{ __html: data.thesaurusHtml }} />
        </Box>
      )}
    </Stack>
  )}

export default DictCollins


