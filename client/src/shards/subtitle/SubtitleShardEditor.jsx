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
import { detect as detectSubtitle } from './SubtitleShard.js'
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
  onChange
}) => {
  const fileInputRef = useRef(null)
  
  // Initialize language tags based on mode
  const getInitialLanguages = () => {
    if (mode === 'edit' && shardData?.data?.languages) {
      return shardData.data.languages.map((lang, index) => ({ 
        code: lang.code,
        filename: lang.filename,
        movie_name: lang.movie_name,
        subtitle_id: lang.subtitle_id,  // Include subtitle_id for linking
        isMain: lang.isMain || index === 0  // Use passed flag, fallback to first
      }))
    }
    return [] // Start empty for create mode, will be populated by processing initialFile
  }

  const [languages, setLanguages] = useState(getInitialLanguages())
  
  // Process initial file in create mode (engine-specific logic)
  useEffect(() => {
    if (mode === 'create' && shardData?.data?.initialFile) {
      const initialFile = shardData.data.initialFile
      const movieName = initialFile.metadata?.movieName || initialFile.metadata?.movie_name || "Unknown Movie"
      const language = initialFile.metadata?.language || "en"
      
      console.debug('🔍 [SubtitleEditor] Processing initial file:', initialFile.filename)
      
      const initialLanguage = {
        code: language,
        filename: initialFile.filename,
        movie_name: movieName,
        file: initialFile.file,
        isMain: true
      }
      
      setLanguages([initialLanguage])
      console.debug('🔍 [SubtitleEditor] Initial language created:', initialLanguage)
      
      // Notify parent of the processed data
      const engineData = formatEngineData([initialLanguage])
      onChange?.(engineData)
    }
  }, [mode, shardData?.data?.initialFile])
  
  // Update languages when shardData changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && shardData?.data?.languages) {
      console.debug('🔄 [SubtitleEditor] Updating languages from shardData:', shardData.data.languages)
      const updatedLanguages = shardData.data.languages.map((lang, index) => ({
        code: lang.code,
        filename: lang.filename,
        movie_name: lang.movie_name,
        subtitle_id: lang.subtitle_id,
        isMain: lang.isMain || index === 0  // Use passed flag, fallback to first
      }))
      setLanguages(updatedLanguages)
      console.debug('🎨 [SubtitleEditor] Cover will use movie:', updatedLanguages[0]?.movie_name)
    }
  }, [mode, shardData?.data?.languages?.length, shardData?.data?.languages?.[0]?.movie_name])
  
  // Format languages data for engine processing
  const formatEngineData = (languagesList) => {
    // Engine only handles language data
    return {
      languages: languagesList // Frontend format with isMain
    }
  }


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

      // Store file for later upload (no upload yet)
      const newLanguage = { 
        code: detectedLanguage, 
        isMain: willBeMain,
        filename: file.name,
        movie_name: movieName,
        file: file // Store file object for later upload
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