import {
  Box,
  Typography,
  Card,
  Grid,
  IconButton
} from '@mui/joy'
import { CheckCircle, RadioButtonUnchecked, Add } from '@mui/icons-material'

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
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    p: 1,
                    lineHeight: 1
                  }}
                >
                  {(() => {
                    // Function to calculate text color based on background brightness
                    const getTextColor = (background) => {
                      // Extract colors from gradient for brightness calculation
                      const colorMatch = background.match(/#([a-f\d]{6})/gi)
                      if (!colorMatch) return '#ffffff'
                      
                      // Use first color in gradient for calculation
                      const hex = colorMatch[0].replace('#', '')
                      const r = parseInt(hex.substr(0, 2), 16)
                      const g = parseInt(hex.substr(2, 2), 16)
                      const b = parseInt(hex.substr(4, 2), 16)
                      
                      // Calculate brightness (0-255)
                      const brightness = (r * 299 + g * 587 + b * 114) / 1000
                      
                      // Return black for bright backgrounds, white for dark
                      return brightness > 140 ? '#000000' : '#ffffff'
                    }

                    try {
                      const cover = JSON.parse(shard.cover || '{}')
                      const formattedText = cover.formattedText
                      const background = cover.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      const textColor = getTextColor(background)
                      
                      if (formattedText && formattedText.lines) {
                        return formattedText.lines.map((line, index) => (
                          <Box
                            key={index}
                            sx={{
                              fontSize: line.size === 'large' ? '16px' : 
                                      line.size === 'medium' ? '13px' : '11px',
                              fontWeight: 900,
                              fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                              lineHeight: 0.9,
                              color: textColor,
                              textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
                              mb: index < formattedText.lines.length - 1 ? 0.3 : 0,
                              letterSpacing: '0.5px'
                            }}
                          >
                            {line.text}
                          </Box>
                        ))
                      }
                      
                      // Fallback for old covers
                      return (
                        <Box sx={{ 
                          fontSize: '14px', 
                          fontWeight: 900,
                          fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                          color: textColor,
                          textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
                          letterSpacing: '0.5px'
                        }}>
                          {(cover.title || shard.name).toUpperCase()}
                        </Box>
                      )
                    } catch {
                      return (
                        <Box sx={{ 
                          fontSize: '14px', 
                          fontWeight: 900,
                          fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                          color: '#ffffff',
                          textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                          letterSpacing: '0.5px'
                        }}>
                          {shard.name.toUpperCase()}
                        </Box>
                      )
                    }
                  })()}
                </Box>
              </Box>

              {/* Info */}
              <Typography 
                level="body-sm" 
                sx={{ 
                  fontWeight: 'md',
                  fontSize: '0.65rem',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  px: 1,
                  mt: 0.5,
                  color: 'text.secondary'
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