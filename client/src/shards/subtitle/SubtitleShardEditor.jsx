import { useState, useRef, useEffect } from 'react'
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
  DialogContent,
  Tooltip
} from '@mui/joy'
import { Add, Upload, Link as LinkIcon, Close } from '@mui/icons-material'
import { detectLanguageWithConfidence } from '../../utils/languageDetection'
import { generateCover, detect as detectSubtitle } from './SubtitleShard.js'
import { useLongPress } from '../../utils/useLongPress.js'

// Simplified component for filename display with tooltip
const TruncatedFilename = ({ filename, isMain, showTooltip, onTooltipClose }) => {
  return (
    <Tooltip
      open={showTooltip}
      title={
        <Box
          sx={{
            maxWidth: 320,
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            p: 0.5
          }}
        >
          {filename}
        </Box>
      }
      placement="top"
      arrow
      onClose={onTooltipClose}
    >
      <Typography 
        level="body-sm" 
        sx={{ 
          flex: 1,
          color: isMain ? 'primary.700' : 'primary.500',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          userSelect: 'none'
        }}
      >
        {filename}
      </Typography>
    </Tooltip>
  )
}

// Reusable language box component
const LanguageBox = ({ children, isMain, isAddButton, onClick, onLongPress }) => {
  const longPressHandlers = useLongPress(
    onLongPress, // Long press callback
    onClick, // Short press callback
    { delay: 500 }
  )

  return (
    <Box
      {...(!isAddButton ? longPressHandlers.handlers : { onClick })}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        px: 1,
        border: isAddButton ? '1px dashed' : '1px solid',
        borderColor: isAddButton ? 'neutral.300' : (isMain ? 'primary.200' : 'primary.100'),
        borderRadius: 8,
        bgcolor: isAddButton ? 'transparent' : (isMain ? 'primary.50' : 'rgba(20, 184, 166, 0.08)'),
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': { bgcolor: isAddButton ? 'neutral.50' : undefined }
      }}
    >
      {children}
    </Box>
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
      return [{ code: detectedInfo.metadata.language, isMain: true }]
    } else if (mode === 'edit' && shardData?.languages) {
      return shardData.languages.map((lang, index) => ({ 
        code: lang, 
        isMain: index === 0 // First language is main (learning) language
      }))
    }
    return [{ code: 'en', isMain: true }] // fallback
  }

  const [languages, setLanguages] = useState(getInitialLanguages())
  const [coverData, setCoverData] = useState({
    type: 'generated', // 'generated' | 'uploaded' | 'url'
    url: '',
    file: null
  })
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })
  const [activeTooltip, setActiveTooltip] = useState(null) // Track which tooltip is shown
  const tooltipTimerRef = useRef(null) // Track the auto-hide timer

  const handleTooltipClick = (filename) => {
    // Clear any existing timer
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }

    if (activeTooltip === filename) {
      // If same tooltip is already shown, hide it
      setActiveTooltip(null)
    } else {
      // Show new tooltip
      setActiveTooltip(filename)
      // Auto-hide tooltip after 4 seconds (longer for better UX)
      tooltipTimerRef.current = setTimeout(() => {
        setActiveTooltip(null)
        tooltipTimerRef.current = null
      }, 4000)
    }
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current)
      }
    }
  }, [])

  const handleLanguageToggle = (index) => {
    const newLanguages = languages.map((lang, i) => ({
      ...lang,
      isMain: i === index // Single selection: only the clicked one is main
    }))
    setLanguages(newLanguages)
    // Only pass cover data if user has configured custom cover
    const coverToSave = coverData.type === 'generated' ? null : coverData
    onChange?.({ languages: newLanguages, cover: coverToSave })
  }

  const handleLanguageDelete = (index) => {
    const newLanguages = languages.filter((_, i) => i !== index)
    // If we deleted the main language, make the first one main (if any remain)
    if (languages[index].isMain && newLanguages.length > 0) {
      newLanguages[0].isMain = true
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
      
      // Only make new language main if no languages are currently main
      const hasMainLanguage = languages.some(lang => lang.isMain)
      const newLanguages = [...languages, { 
        code: langDetection.language, 
        isMain: !hasMainLanguage, // Only make main if no other language is main
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
              <LanguageBox
                key={index}
                isMain={lang.isMain}
                isAddButton={false}
                onClick={() => handleLanguageToggle(index)}
                onLongPress={() => handleTooltipClick(filename)}
              >
                <Chip
                  variant={lang.isMain ? 'solid' : 'outlined'}
                  color="primary"
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
                  isMain={lang.isMain}
                  showTooltip={activeTooltip === filename}
                  onTooltipClose={() => setActiveTooltip(null)}
                />
                
                {/* Delete button - always show */}
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleLanguageDelete(index)
                  }}
                  sx={{
                    minWidth: 24,
                    minHeight: 24,
                    '&:hover': { 
                      bgcolor: 'danger.100',
                      color: 'danger.500'
                    }
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </LanguageBox>
            )
          })}
          
          {/* Add Language Button */}
          <LanguageBox
            isAddButton={true}
            onClick={handleAddLanguage}
          >
            <Typography level="body-sm" color="neutral">
              + Add a subtitle
            </Typography>
          </LanguageBox>
        </Stack>
        <Typography level="body-xs" sx={{ mt: 1, color: 'text.tertiary' }}>
          Solid = Main language, Outlined = Reference. Press to select main, long press to view filename (press again to hide).
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


    </Stack>
  )
} 