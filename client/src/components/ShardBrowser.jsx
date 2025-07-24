import {
  Box,
  Typography,
  Card,
  Grid,
  IconButton
} from '@mui/joy'
import { PlayArrow, CheckCircle, RadioButtonUnchecked, Add } from '@mui/icons-material'

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
    <Box sx={{ 
      maxWidth: 800, 
      mx: 'auto',
      px: 2,
      pt: 1.5
    }}>
      <Grid container rowSpacing={3.5} columnSpacing={1.5}>
        {shards.map((shard, index) => {
          const isSelected = selected.includes(shard.id)
          
          return (
            <Grid 
              key={shard.id || `shard-${index}`} 
              xs={4} 
              sm={3} 
              md={2.4} 
              lg={2} 
              xl={1.7}
              sx={{
                display: 'flex',
                justifyContent: 'center'
              }}
            >
            <Card 
              sx={{ 
                p: 0, 
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                border: 'none',
                boxShadow: 'none',
                bgcolor: 'transparent',
                width: '100%',
                maxWidth: 90,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                ...(!editing && {
                  '&:hover': { 
                    transform: 'translateY(-2px)'
                  }
                })
              }}
              onClick={() => editing ? onToggleSelect(shard.id) : onOpenShard(shard.id)}
            >
              {/* Cover */}
              <Box 
                sx={{ 
                  width: '100%', 
                  height: 100, 
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
                <PlayArrow sx={{ color: 'white', fontSize: 24 }} />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    p: 0.5
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
              <Typography 
                level="body-sm" 
                sx={{ 
                  fontWeight: 'md',
                  fontSize: '0.75rem',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  px: 1,
                  mt: 0.5
                }}
              >
                {shard.name}
              </Typography>
            </Card>
          </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}