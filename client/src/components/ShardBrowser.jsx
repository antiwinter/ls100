import {
  Box,
  Typography,
  Card,
  Stack,
  Grid,
  IconButton
} from '@mui/joy'
import { PlayArrow, CheckCircle, RadioButtonUnchecked, Add } from '@mui/icons-material'
import { formatRelativeTime } from '../utils/dateFormat'

export const ShardBrowser = ({ shards, onOpenShard, editing, selected = [], onToggleSelect, onImport }) => {
  if (shards.length === 0) {
    return (
      <Box sx={{ 
        textAlign: 'center', 
        py: 12,
        px: 4
      }}>
        <Box 
          onClick={onImport}
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 3,
            border: '2px dashed #E5E7EB',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#FAFAFA',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': {
              opacity: 0.8
            }
          }}
        >
          <Add sx={{ 
            fontSize: 32, 
            color: '#D1D5DB' 
          }} />
        </Box>
        <Typography 
          level="body-md"
          sx={{ 
            color: '#9CA3AF',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            maxWidth: 280,
            mx: 'auto'
          }}
        >
          <strong>Import</strong> learning materials or visit the <strong>Explore</strong> tab to discover content and get started
        </Typography>
      </Box>
    )
  }

  return (
    <Grid container spacing={2}>
      {shards.map((shard, index) => {
        const isSelected = selected.includes(shard.id)
        
        return (
          <Grid key={shard.id || `shard-${index}`} xs={12} sm={6} md={4}>
            <Card 
              sx={{ 
                p: 3, 
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                ...(!editing && {
                  '&:hover': { 
                    transform: 'translateY(-2px)',
                    boxShadow: 'lg'
                  }
                })
              }}
              onClick={() => editing ? onToggleSelect(shard.id) : onOpenShard(shard.id)}
            >
              {editing && (
                <IconButton
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1
                  }}
                  size="sm"
                  color={isSelected ? 'primary' : 'neutral'}
                >
                  {isSelected ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
              )}
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
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Typography level="body-xs" color="neutral">
                    {formatRelativeTime(shard.last_used || shard.created_at)}
                  </Typography>
                  {shard.completion_rate > 0 && (
                    <Typography level="body-xs" color="primary">
                      • {Math.round(shard.completion_rate * 100)}%
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Card>
        </Grid>
        )
      })}
    </Grid>
  )
} 