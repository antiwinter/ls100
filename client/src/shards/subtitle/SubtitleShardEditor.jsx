import { useState, useRef } from 'react'
import { 
  Box, 
  Typography, 
  Stack, 
  Button, 
  Chip, 
  Card,
  Switch,
  Input,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent
} from '@mui/joy'
import { Add, Upload, Link as LinkIcon, Close } from '@mui/icons-material'
import { detectLanguageWithConfidence } from '../../utils/languageDetection'
import { generateCover, detect as detectSubtitle } from './SubtitleShard.js'

// Component for filename display with CSS ellipsis and long press tooltip
const TruncatedFilename = ({ filename, isEnabled, onLongPress, onShortPress }) => {
  const [isPressed, setIsPressed] = useState(false)
  const pressTimerRef = useRef(null)
  const longPressThreshold = 500 // 500ms for long press
  const isLongPressRef = useRef(false)

  const handlePressStart = (e) => {
    e.preventDefault() // Prevent text selection
    e.stopPropagation() // Stop event bubbling
    setIsPressed(true)
    isLongPressRef.current = false
    
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      onLongPress(filename)
      setIsPressed(false)
    }, longPressThreshold)
  }

  const handlePressEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    
    // If it wasn't a long press, trigger short press
    if (!isLongPressRef.current) {
      onShortPress()
    }
    
    setIsPressed(false)
  }

  return (
    <Typography 
      level="body-sm" 
      sx={{ 
        flex: 1,
        color: isEnabled ? 'text.primary' : 'text.secondary',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        cursor: 'pointer',
        opacity: isPressed ? 0.7 : 1,
        transition: 'opacity 0.1s ease'
      }}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      title={filename} // Fallback tooltip for desktop
    >
      {filename}
    </Typography>
  )
}

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
      return shardData.languages.map((lang, index) => ({ 
        code: lang, 
        enabled: index === 0 // Only first language is enabled (learning language)
      }))
    }
    return [{ code: 'en', enabled: true }] // fallback
  }

  const [languages, setLanguages] = useState(getInitialLanguages())
  const [coverData, setCoverData] = useState({
    type: 'generated', // 'generated' | 'uploaded' | 'url'
    url: '',
    file: null
  })
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })
  const [tooltipDialog, setTooltipDialog] = useState({ open: false, filename: '' })

  const handleLongPress = (filename) => {
    setTooltipDialog({ open: true, filename })
  }

  const handleLanguageToggle = (index) => {
    const newLanguages = languages.map((lang, i) => ({
      ...lang,
      enabled: i === index // Single selection: only the clicked one is enabled
    }))
    setLanguages(newLanguages)
    // Only pass cover data if user has configured custom cover
    const coverToSave = coverData.type === 'generated' ? null : coverData
    onChange?.({ languages: newLanguages, cover: coverToSave })
  }

  const handleLanguageDelete = (index) => {
    if (languages.length <= 1) return // Don't allow deleting the last language
    
    const newLanguages = languages.filter((_, i) => i !== index)
    // If we deleted the enabled language, enable the first one
    if (languages[index].enabled && newLanguages.length > 0) {
      newLanguages[0].enabled = true
    }
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
      // First, check if the file is a valid subtitle file
      const buffer = await file.arrayBuffer()
      const detectionResult = detectSubtitle(file.name, buffer)
      
      if (!detectionResult.match || detectionResult.confidence < 0.5) {
        setErrorDialog({ 
          open: true, 
          message: 'The selected file is not a valid subtitle file. Please select a subtitle file (.srt, .vtt, .ass, etc.)' 
        })
        return
      }

      // Auto-detect language from the file content
      const content = new TextDecoder('utf-8').decode(buffer)
      const langDetection = detectLanguageWithConfidence(content)
      
      // Check if this language is already in the list
      const existingLang = languages.find(lang => lang.code === langDetection.language)
      if (existingLang) {
        setErrorDialog({ 
          open: true, 
          message: `${langDetection.language.toUpperCase()} language is already added to this shard.` 
        })
        return
      }
      
      // Only enable new language if no languages are currently enabled
      const hasEnabledLanguage = languages.some(lang => lang.enabled)
      const newLanguages = [...languages, { 
        code: langDetection.language, 
        enabled: !hasEnabledLanguage, // Only enable if no other language is enabled
        filename: file.name // Store filename for display
      }]
      setLanguages(newLanguages)
      // Only pass cover data if user has configured custom cover
      const coverToSave = coverData.type === 'generated' ? null : coverData
      onChange?.({ languages: newLanguages, cover: coverToSave })
    } catch (error) {
      console.error('Failed to process language file:', error)
      setErrorDialog({ 
        open: true, 
        message: 'Failed to process the selected file. Please try again.' 
      })
    } finally {
      // Clear the file input to allow selecting the same file again if needed
      if (e.target) {
        e.target.value = ''
      }
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
          {languages.map((lang, index) => {
            const filename = index === 0 && detectedInfo?.filename 
              ? detectedInfo.filename 
              : lang.filename || `Additional ${lang.code.toUpperCase()} subtitle file`
            
            return (
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
                  opacity: lang.enabled ? 1 : 0.6,
                  position: 'relative'
                }}
              >
                                 <Chip
                   variant={lang.enabled ? 'solid' : 'outlined'}
                   color={lang.enabled ? 'primary' : 'neutral'}
                   size="sm"
                   sx={{ 
                     minWidth: 40,
                     display: 'flex',
                     justifyContent: 'center',
                     alignItems: 'center',
                     textAlign: 'center',
                     '& .MuiChip-label': {
                       display: 'flex',
                       justifyContent: 'center',
                       alignItems: 'center',
                       width: '100%'
                     }
                   }}
                 >
                  {lang.code.toUpperCase()}
                </Chip>
                
                                 <TruncatedFilename 
                   filename={filename}
                   isEnabled={lang.enabled}
                   onLongPress={handleLongPress}
                   onShortPress={() => handleLanguageToggle(index)}
                 />
                
                {/* Delete button - only show when there are multiple languages */}
                {languages.length > 1 && (
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={() => handleLanguageDelete(index)}
                    sx={{
                      minWidth: 32,
                      minHeight: 32,
                      '&:hover': { 
                        bgcolor: 'danger.100',
                        color: 'danger.500'
                      }
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )
          })}
          
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
          Tap to select learning language. Long press filename to view full name.
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
      
      {/* Error Dialog */}
      <Modal open={errorDialog.open} onClose={() => setErrorDialog({ open: false, message: '' })}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>Error</DialogTitle>
          <DialogContent>
            {errorDialog.message}
          </DialogContent>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
            <Button 
              variant="solid" 
              color="primary" 
              onClick={() => setErrorDialog({ open: false, message: '' })}
            >
              OK
            </Button>
          </Box>
        </ModalDialog>
      </Modal>

      {/* Filename Tooltip Dialog */}
      <Modal open={tooltipDialog.open} onClose={() => setTooltipDialog({ open: false, filename: '' })}>
        <ModalDialog variant="outlined" size="md">
          <DialogTitle>Full Filename</DialogTitle>
          <DialogContent>
            <Typography 
              level="body-sm" 
              sx={{ 
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: 1.5
              }}
            >
              {tooltipDialog.filename}
            </Typography>
          </DialogContent>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
            <Button 
              variant="outlined" 
              color="neutral" 
              onClick={() => setTooltipDialog({ open: false, filename: '' })}
            >
              Close
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    </Stack>
  )
} 