import { useState, useRef, useEffect, useMemo } from 'react'
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
import { generateCover, detect as detectSubtitle } from './SubtitleShard.js'
import { useLongPress } from '../../utils/useLongPress.js'
import { apiCall } from '../../config/api.js'

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
    } else if (mode === 'edit' && shardData?.shard_data?.languages) {
      return shardData.shard_data.languages.map((lang, index) => ({ 
        code: lang.code,
        filename: lang.filename,
        movie_name: lang.movie_name,
        subtitle_id: lang.subtitle_id,  // Include subtitle_id for linking
        isMain: lang.isMain || index === 0  // Use passed flag, fallback to first
      }))
    }
    return [{ code: 'en', isMain: true }] // fallback
  }

  const [languages, setLanguages] = useState(getInitialLanguages())
  
  // Update languages when shardData changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && shardData?.shard_data?.languages) {
      console.debug('🔄 [SubtitleEditor] Updating languages from shardData:', shardData.shard_data.languages)
      const updatedLanguages = shardData.shard_data.languages.map((lang, index) => ({
        code: lang.code,
        filename: lang.filename,
        movie_name: lang.movie_name,
        subtitle_id: lang.subtitle_id,  // Include subtitle_id for linking
        isMain: lang.isMain || index === 0  // Use passed flag, fallback to first
      }))
      setLanguages(updatedLanguages)
      console.debug('🎨 [SubtitleEditor] Cover will use movie:', updatedLanguages[0]?.movie_name)
    }
  }, [mode, shardData?.shard_data?.languages?.length, shardData?.shard_data?.languages?.[0]?.movie_name])
  
  // Format languages data for engine processing
  const formatEngineData = (languagesList) => {
    const coverToSave = coverData.type === 'generated' ? null : coverData
    
    if (mode === 'edit') {
      // In edit mode, format subtitles with is_main flags for backend
      const subtitles = languagesList
        .filter(lang => lang.subtitle_id || lang.pendingFile)
        .map(lang => ({
          subtitle_id: lang.subtitle_id,
          is_main: lang.isMain || false,
          pendingFile: lang.pendingFile,
          pendingMovieName: lang.pendingMovieName,
          code: lang.code
        }))
      
      return {
        languages: languagesList, // Keep for UI
        subtitles: subtitles,     // For backend processing
        cover: coverToSave
      }
    } else {
      // In create mode, just pass languages for UI
      return {
        languages: languagesList,
        cover: coverToSave
      }
    }
  }

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
    console.debug('🔄 [SubtitleEditor] Language toggle:', { index, currentLanguages: languages })
    
    const newLanguages = languages.map((lang, i) => ({
      ...lang,
      isMain: i === index // Single selection: only the clicked one is main
    }))
    
    console.debug('🔄 [SubtitleEditor] Updated languages after toggle:', newLanguages)
    setLanguages(newLanguages)
    
    // Format and pass engine-specific data
    const engineData = formatEngineData(newLanguages)
    console.debug('🔄 [SubtitleEditor] Engine data after toggle:', engineData)
    onChange?.(engineData)
  }

  const handleLanguageDelete = (index) => {
    const newLanguages = languages.filter((_, i) => i !== index)
    // If we deleted the main language, make the first one main (if any remain)
    if (languages[index].isMain && newLanguages.length > 0) {
      newLanguages[0].isMain = true
    }
          setLanguages(newLanguages)
      
      // Format and pass engine-specific data
      const engineData = formatEngineData(newLanguages)
      onChange?.(engineData)
  }

  const handleAddLanguage = () => {
    fileInputRef.current?.click()
  }

  const handleLanguageFileSelect = async (e) => {
    const file = e.target.files?.[0]
    console.debug('🔍 [SubtitleEditor] File selected:', file?.name, 'size:', file?.size)
    
    if (!file) return
    
    try {
      // First, check if the file is a valid subtitle file
      const buffer = await file.arrayBuffer()
      const detectionResult = detectSubtitle(file.name, buffer)
      console.debug('🔍 [SubtitleEditor] Subtitle detection result:', detectionResult)
      
      if (!detectionResult.match || detectionResult.confidence < 0.5) {
        setErrorDialog({ 
          open: true, 
          message: 'The selected file is not a valid subtitle file. Please select a subtitle file (.srt, .vtt, .ass, etc.)' 
        })
        return
      }

      // Use language from comprehensive detection (no duplication)
      const detectedLanguage = detectionResult.metadata.language
      console.debug('🔍 [SubtitleEditor] Using detected language:', detectedLanguage)
      
      // Check if this language is already in the list
      const existingLang = languages.find(lang => lang.code === detectedLanguage)
      if (existingLang) {
        setErrorDialog({ 
          open: true, 
          message: `${detectedLanguage.toUpperCase()} language is already added to this shard.` 
        })
        return
      }
      
      // Movie name logic: always follow the main language
      let movieName = "Unknown Movie"
      
      // Determine if this new language will become main
      const hasMain = languages.some(lang => lang.isMain)
      const willBeMain = !hasMain // If no main exists, this becomes main
      
      console.debug('🔍 [SubtitleEditor] Main language logic:', { hasMain, willBeMain, currentLanguages: languages })
      
      if (willBeMain) {
        // New language becomes main -> use its movie name
        movieName = detectionResult?.metadata?.movieName || "Unknown Movie"
        console.debug('🔍 [SubtitleEditor] New main language, using movie name:', movieName)
      } else {
        // Keep existing main language's movie name
        const mainLang = languages.find(lang => lang.isMain)
        if (mainLang?.movie_name) {
          movieName = mainLang.movie_name
        } else if (detectedInfo?.metadata?.movieName || detectedInfo?.metadata?.movie_name) {
          movieName = detectedInfo.metadata.movieName || detectedInfo.metadata.movie_name
        }
        console.debug('🔍 [SubtitleEditor] Keeping main language movie name:', movieName, 'from:', mainLang)
      }

      // Only make new language main if no languages are currently main
      const newLanguage = { 
        code: detectedLanguage, 
        isMain: willBeMain,
        filename: file.name, // Store filename for display
        movie_name: movieName,
        pendingFile: file, // Store file for later upload
        pendingMovieName: movieName // Store movie name for upload
      }
      
      console.debug('🔍 [SubtitleEditor] Creating new language entry:', newLanguage)

      const newLanguages = [...languages, newLanguage]
      setLanguages(newLanguages)
      console.debug('🔍 [SubtitleEditor] Updated languages list:', newLanguages)

      // Format engine-specific data
      const engineData = formatEngineData(newLanguages)
      console.debug('🔍 [SubtitleEditor] Formatted engine data:', engineData)
      onChange?.(engineData)
      
    } catch (error) {
      console.error('❌ [SubtitleEditor] Failed to process language file:', error)
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

  // Calculate cover data only when actual movie data changes
  const generatedCoverData = useMemo(() => {
    let movieName = 'Movie Title'
    let identifier = 'default'
    
    if (mode === 'create' && detectedInfo?.metadata) {
      // Create mode: use detected info
      movieName = detectedInfo.metadata.movieName || detectedInfo.metadata.movie_name || 'Movie Title'
      identifier = movieName
    } else if (mode === 'edit' && languages.length > 0) {
      // Edit mode: use movie name from loaded subtitles  
      movieName = languages[0].movie_name || 'Movie Title'
      identifier = movieName
    }
    
    return {
      movieName,
      identifier
    }
  }, [
    mode, 
    detectedInfo?.metadata?.movieName, 
    detectedInfo?.metadata?.movie_name,
    languages?.[0]?.movie_name  // Only when actual movie name changes
  ])

  return (
    <Stack spacing={3}>
      {/* Language Files Section */}
      <Box>
        <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
          Subtitles
        </Typography>
        <Stack spacing={1}>
          {languages.map((lang, index) => {
            // In edit mode, always use the filename from loaded subtitle data
            // In create mode, use detectedInfo for the first entry only
            let filename = (mode === 'create' && index === 0 && detectedInfo?.filename)
              ? detectedInfo.filename 
              : lang.filename || `Additional ${lang.code.toUpperCase()} subtitle file`
            
            // Add pending indicator for files not yet uploaded
            if (lang.pendingFile) {
              filename = `${filename} (pending upload)`
            }
            
            
            
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
                                      const coverDataInfo = generatedCoverData
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