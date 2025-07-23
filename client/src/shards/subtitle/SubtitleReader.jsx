import { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  Stack,
  LinearProgress,
  IconButton
} from '@mui/joy'
import { 
  ArrowBack, 
  ArrowForward, 
  PlayArrow,
  Pause
} from '@mui/icons-material'
import { apiCall } from '../../config/api'

export const SubtitleReader = ({ shardId, onBack }) => {
  const [lines, setLines] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shard, setShard] = useState(null)

  useEffect(() => {
    loadShard()
  }, [shardId])

  const loadShard = async () => {
    try {
      const shardData = await apiCall(`/api/shards/${shardId}`)
      setShard(shardData.shard)
      
      // Load subtitle content (first subtitle for now)
      if (shardData.subtitles?.length > 0) {
        await loadSubtitle(shardData.subtitles[0].subtitle_id)
      }
    } catch (error) {
      console.error('Failed to load shard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSubtitle = async (subtitleId) => {
    try {
      const data = await apiCall(`/api/subtitles/${subtitleId}/lines`)
      setLines(data.lines || [])
    } catch (error) {
      console.error('Failed to load subtitle:', error)
    }
  }

  const next = () => current < lines.length - 1 && setCurrent(current + 1)
  const prev = () => current > 0 && setCurrent(current - 1)
  
  const progress = lines.length > 0 ? ((current + 1) / lines.length) * 100 : 0

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading subtitle...</Typography>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    )
  }

  if (!lines.length) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="danger">No subtitle content found</Typography>
        <Button onClick={onBack} sx={{ mt: 2 }}>Go Back</Button>
      </Box>
    )
  }

  const line = lines[current]

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={onBack}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography level="h4">{shard?.name}</Typography>
            <Typography level="body-sm" color="neutral">
              {current + 1} / {lines.length}
            </Typography>
          </Box>
        </Stack>
        <LinearProgress 
          determinate 
          value={progress} 
          sx={{ mt: 1 }}
        />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        <Card sx={{ p: 4, textAlign: 'center', minHeight: 200 }}>
          {line?.start && (
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              {formatTime(line.start)} → {formatTime(line.end)}
            </Typography>
          )}
          
          <Typography 
            level="h3" 
            sx={{ 
              lineHeight: 1.6,
              cursor: 'pointer',
              '& span': {
                padding: '2px 4px',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
                '&:hover': {
                  backgroundColor: 'primary.100'
                }
              }
            }}
            onClick={handleWordClick}
          >
            {renderText(line?.text || '')}
          </Typography>
        </Card>
      </Box>

      {/* Navigation */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="center" spacing={2}>
          <Button 
            variant="outlined" 
            onClick={prev} 
            disabled={current === 0}
            startDecorator={<ArrowBack />}
          >
            Previous
          </Button>
          <Button 
            variant="outlined" 
            onClick={next} 
            disabled={current === lines.length - 1}
            endDecorator={<ArrowForward />}
          >
            Next
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

// Format time from milliseconds to MM:SS
const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Render text with clickable words
const renderText = (text) => {
  return text.split(/(\s+)/).map((part, idx) => 
    /\s/.test(part) ? part : (
      <span key={idx} data-word={part.replace(/[^\w]/g, '')}>
        {part}
      </span>
    )
  )
}

// Handle word click for learning
const handleWordClick = (e) => {
  const word = e.target.getAttribute('data-word')
  if (word && word.length > 1) {
    console.log('Selected word:', word)
    // TODO: Open dictionary or add to learning list
  }
} 