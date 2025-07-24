import {
  Box,
  Typography,
  Card,
  Grid,
  IconButton
} from '@mui/joy'
import { CheckCircle, RadioButtonUnchecked, Add } from '@mui/icons-material'
import { generateCover } from '../shards/subtitle/SubtitleShard.js'

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
                    // If custom cover URL exists, use solid color background (image will overlay)
                    if (shard.cover_url) {
                      return '#f0f0f0'
                    }
                    // Otherwise use dynamic generation with movie name
                    const movieName = shard.subtitles?.[0]?.movie_name || shard.name
                    const dynamicCover = generateCover(movieName, shard.id?.toString() || movieName)
                    return dynamicCover.background
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
                    // If custom cover URL exists, try to load it
                    if (shard.cover_url) {
                      return (
                        <img
                          src={shard.cover_url}
                          alt={`${shard.name} cover`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 8
                          }}
                          onError={(e) => {
                            // Fallback to dynamic cover if image fails to load
                            e.target.style.display = 'none'
                            const movieName = shard.subtitles?.[0]?.movie_name || shard.name
                            const dynamicCover = generateCover(movieName, shard.id?.toString() || movieName)
                            const fallbackElement = e.target.nextSibling
                            if (fallbackElement) {
                              fallbackElement.style.display = 'flex'
                            }
                          }}
                        />
                      )
                    }
                    
                    // Use dynamic generation with movie name
                    const movieName = shard.subtitles?.[0]?.movie_name || shard.name
                    const dynamicCover = generateCover(movieName, shard.id?.toString() || movieName)
                    
                    if (dynamicCover.formattedText && dynamicCover.formattedText.lines) {
                      return dynamicCover.formattedText.lines.map((line, index) => (
                        <Box
                          key={index}
                          sx={line.styles || {
                            fontSize: '14px',
                            fontWeight: 900,
                            fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                            lineHeight: 0.9,
                            color: dynamicCover.textColor || '#ffffff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                            mb: index < dynamicCover.formattedText.lines.length - 1 ? 0.3 : 0,
                            letterSpacing: '0.5px'
                          }}
                        >
                          {line.text}
                        </Box>
                      ))
                    }
                    
                    // Fallback
                    return (
                      <Box sx={{ 
                        fontSize: '14px', 
                        fontWeight: 900,
                        fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                        color: dynamicCover.textColor || '#ffffff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                        letterSpacing: '0.5px'
                      }}>
                        {movieName.toUpperCase()}
                      </Box>
                    )
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