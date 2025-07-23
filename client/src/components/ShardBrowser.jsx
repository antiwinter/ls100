import {
  Box,
  Typography,
  Card,
  Stack,
  Grid
} from '@mui/joy'
import { PlayArrow } from '@mui/icons-material'
import { formatRelativeTime } from '../utils/dateFormat'

export const ShardBrowser = ({ shards, onOpenShard }) => {
  if (shards.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography level="h4" color="neutral">
          No learning content yet
        </Typography>
        <Typography color="neutral" sx={{ mt: 1 }}>
          Upload a subtitle file to get started
        </Typography>
      </Box>
    )
  }

  return (
    <Grid container spacing={2}>
      {shards.map((shard, index) => (
        <Grid key={shard.id || `shard-${index}`} xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              p: 3, 
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { 
                transform: 'translateY(-2px)',
                boxShadow: 'lg'
              }
            }}
            onClick={() => onOpenShard(shard.id)}
          >
            <Stack spacing={2}>
              {/* Cover */}
              <Box 
                sx={{ 
                  width: '100%', 
                  height: 120, 
                  borderRadius: 8,
                  background: (() => {
                    try {
                      const cover = JSON.parse(shard.cover || '{}')
                      return cover.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    } catch {
                      return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }
                  })(),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <PlayArrow sx={{ color: 'white', fontSize: 36 }} />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    p: 1
                  }}
                >
                  {(() => {
                    try {
                      const cover = JSON.parse(shard.cover || '{}')
                      return cover.title || shard.name
                    } catch {
                      return shard.name
                    }
                  })()}
                </Box>
              </Box>

              {/* Info */}
              <Box>
                <Typography level="title-md" noWrap>
                  {shard.name}
                </Typography>
                {shard.description && (
                  <Typography 
                    level="body-sm" 
                    color="neutral"
                    sx={{ 
                      mt: 0.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {shard.description}
                  </Typography>
                )}
                <Typography level="body-xs" color="neutral" sx={{ mt: 1 }}>
                  {formatRelativeTime(shard.created_at)}
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
} 