import { useState, useRef } from 'react'
import { 
  Box, 
  Typography, 
  Stack, 
  Button, 
  Chip, 
  Card,
  Switch,
  Input
} from '@mui/joy'
import { Add, Upload, Link as LinkIcon } from '@mui/icons-material'
import { detectLanguageWithConfidence } from '../../utils/languageDetection'
import { generateCover } from './SubtitleShard.js'

export const SubtitleShardEditor = ({ 
  mode = 'create', 
  shardData = null,
  detectedInfo = null,
  onChange,
  onCoverClick
}) => {
  const fileInputRef = useRef(null)
  const [customCoverUrl, setCustomCoverUrl] = useState('')
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false)
  
  // Initialize language tags based on mode
  const getInitialLanguages = () => {
    if (mode === 'create' && detectedInfo?.metadata?.language) {
      return [{ code: detectedInfo.metadata.language, enabled: true }]
    } else if (mode === 'edit' && shardData?.languages) {
      return shardData.languages.map(lang => ({ code: lang, enabled: true }))
    }
    return [{ code: 'en', enabled: true }] // fallback
  }

  const [languages, setLanguages] = useState(getInitialLanguages())
  const [coverData, setCoverData] = useState({
    type: 'generated', // 'generated' | 'uploaded' | 'url'
    url: '',
    file: null
  })

  const handleLanguageToggle = (index) => {
    const newLanguages = [...languages]
    newLanguages[index].enabled = !newLanguages[index].enabled
    setLanguages(newLanguages)
    // Only pass cover data if user has configured custom cover
    const coverToSave = coverData.type === 'generated' ? null : coverData
    onChange?.({ languages: newLanguages, cover: coverToSave })
  }

  const handleAddLanguage = () => {
    fileInputRef.current?.click()
  }

  const handleLanguageFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Auto-detect language from the file content
      const content = await file.text()
      const langDetection = detectLanguageWithConfidence(content)
      
      // Check if this language is already in the list
      const existingLang = languages.find(lang => lang.code === langDetection.language)
      if (existingLang) {

        return
      }
      
      const newLanguages = [...languages, { code: langDetection.language, enabled: true }]
      setLanguages(newLanguages)
      // Only pass cover data if user has configured custom cover
      const coverToSave = coverData.type === 'generated' ? null : coverData
      onChange?.({ languages: newLanguages, cover: coverToSave })
    } catch (error) {
      console.error('Failed to process language file:', error)
    }
  }

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    const newCoverData = { type: 'uploaded', url, file }
    setCoverData(newCoverData)
    // Pass actual cover data for uploads (will be saved as cover_url)
    onChange?.({ languages, cover: newCoverData })
  }

  const handleCoverUrl = (url) => {
    const newCoverData = { type: 'url', url, file: null }
    setCoverData(newCoverData)
    setCustomCoverUrl(url)
    // Pass actual cover data for URLs (will be saved as cover_url)
    onChange?.({ languages, cover: newCoverData })
  }

  const resetToGeneratedCover = () => {
    const newCoverData = { type: 'generated', url: '', file: null }
    setCoverData(newCoverData)
    setCustomCoverUrl('')
    setShowCoverUrlInput(false)
    // Pass null for generated covers (won't be saved, uses dynamic generation)
    onChange?.({ languages, cover: null })
  }



  const getCurrentCoverPreview = () => {
    if (coverData.type === 'uploaded' || coverData.type === 'url') {
      return coverData.url
    }
    // For generated covers, return null to show the generated cover component
    return null
  }

  const getGeneratedCoverData = () => {
    // Get movie name from detected info for generated cover (parseMovieInfo returns 'movieName' not 'movie_name')
    const movieName = mode === 'create' && detectedInfo?.metadata?.movieName
      ? detectedInfo.metadata.movieName
      : mode === 'create' && detectedInfo?.metadata?.movie_name
      ? detectedInfo.metadata.movie_name
      : 'Movie Title'
    
    return {
      movieName,
      // We'll use the filename or movie name to generate consistent colors
      identifier: detectedInfo?.filename || movieName
    }
  }

  return (
    <Stack spacing={3}>
      {/* Language Files Section */}
      <Box>
        <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
          Subtitles
        </Typography>
        <Stack spacing={1}>
          {languages.map((lang, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                border: '1px solid',
                borderColor: lang.enabled ? 'primary.200' : 'neutral.300',
                borderRadius: 8,
                bgcolor: lang.enabled ? 'primary.50' : 'neutral.50',
                opacity: lang.enabled ? 1 : 0.6
              }}
            >
              <Chip
                variant={lang.enabled ? 'solid' : 'outlined'}
                color={lang.enabled ? 'primary' : 'neutral'}
                size="sm"
                onClick={() => handleLanguageToggle(index)}
                sx={{ 
                  cursor: 'pointer',
                  minWidth: 40,
                  '&:hover': { opacity: 0.8 }
                }}
              >
                {lang.code.toUpperCase()}
              </Chip>
              <Typography level="body-sm" sx={{ flex: 1, color: lang.enabled ? 'text.primary' : 'text.secondary' }}>
                {index === 0 && detectedInfo?.filename ? detectedInfo.filename : `Additional ${lang.code.toUpperCase()} subtitle file`}
              </Typography>
            </Box>
          ))}
          
          {/* Add Language Button */}
          <Box
            onClick={handleAddLanguage}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              border: '1px dashed',
              borderColor: 'neutral.300',
              borderRadius: 8,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'neutral.50' }
            }}
          >
            <Typography level="body-sm" color="neutral">
              + Add subtitle in another lang
            </Typography>
          </Box>
        </Stack>
        <Typography level="body-xs" sx={{ mt: 1, color: 'text.tertiary' }}>
          You can always add other languages to this shard later
        </Typography>
        
        {/* Hidden file input for language files */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.ass,.ssa,.sub"
          style={{ display: 'none' }}
          onChange={handleLanguageFileSelect}
        />
      </Box>

      {/* Cover Preview Section */}
      <Box>
        <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
          Preview
        </Typography>
        {/* Cover Preview */}
        <Box
          sx={{
            width: 90,
            height: 100,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider'
          }}
          onClick={onCoverClick}
        >
              {getCurrentCoverPreview() ? (
                <img
                  src={getCurrentCoverPreview()}
                  alt="Cover preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 8
                  }}
                />
              ) : (
                (() => {
                  const coverDataInfo = getGeneratedCoverData()
                  const generatedCover = generateCover(coverDataInfo.movieName, coverDataInfo.identifier)
                  
                  // Function to calculate text color based on background brightness
                  const getTextColor = (background) => {
                    const colorMatch = background.match(/#([a-f\d]{6})/gi)
                    if (!colorMatch) return '#ffffff'
                    
                    const hex = colorMatch[0].replace('#', '')
                    const r = parseInt(hex.substr(0, 2), 16)
                    const g = parseInt(hex.substr(2, 2), 16)
                    const b = parseInt(hex.substr(4, 2), 16)
                    
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000
                    return brightness > 140 ? '#000000' : '#ffffff'
                  }

                  const textColor = getTextColor(generatedCover.background)
                  
                  return (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        background: generatedCover.background,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: textColor,
                        textAlign: 'center',
                        p: 1,
                        borderRadius: 8,
                        lineHeight: 1
                      }}
                    >
                                        {generatedCover.formattedText?.lines ? 
                    generatedCover.formattedText.lines.map((line, index) => (
                      <Box
                        key={index}
                        sx={line.styles || {
                          fontSize: '11px',
                          fontWeight: 900,
                          fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                          lineHeight: 0.9,
                          color: textColor,
                          textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
                          mb: index < generatedCover.formattedText.lines.length - 1 ? 0.2 : 0,
                          letterSpacing: '0.3px'
                        }}
                      >
                        {line.text}
                      </Box>
                    )) :
                    <Box sx={{ 
                      fontSize: '11px', 
                      fontWeight: 900,
                      fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                      color: textColor,
                      textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
                      letterSpacing: '0.3px'
                    }}>
                      {coverDataInfo.movieName.toUpperCase()}
                    </Box>
                  }
                    </Box>
                  )
                })()
              )}
            </Box>
      </Box>

      {/* Pro Features (Disabled) */}
      <Box>
        <Typography level="body-sm" sx={{ mb: 2, color: 'primary.500', fontWeight: 'bold' }}>
          Pro Features
        </Typography>
        <Stack spacing={2}>
          {/* Movie Poster */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Get movie poster</Typography>
            <Switch disabled size="md" />
          </Box>

          {/* Character Name Matching */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Match charater names</Typography>
            <Switch disabled size="md" />
          </Box>
        </Stack>
      </Box>
    </Stack>
  )
} 