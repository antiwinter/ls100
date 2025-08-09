import { useState, useRef, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Stack, 
  Chip, 
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  Button,
  Switch,
  Tooltip
} from '@mui/joy'
import { Close } from '@mui/icons-material'
import { detect } from './SubtitleShard.js'
import { useLongPress } from '../../utils/useLongPress.js'
import { log } from '../../utils/logger'


// Extract language data from detectedInfo
const extractLanguage = (detectedInfo) => {
  if (!detectedInfo) return []
  
  const movieName = detectedInfo.metadata?.movieName || detectedInfo.metadata?.movie_name || 'Unknown Movie'
  const language = detectedInfo.metadata?.language || 'en'
  const lang = {
    code: language,
    filename: detectedInfo.filename,
    movie_name: movieName,
    file: detectedInfo.file,
    isMain: true
  }
  log.debug('extracted', detectedInfo, lang)
  return [lang]
}

const TruncatedFilename = ({ filename, isMain, showTooltip, onTooltipClose }) => (
  <Tooltip
    open={showTooltip}
    title={
      <Box sx={{ maxWidth: 320, whiteSpace: 'normal', wordWrap: 'break-word', fontFamily: 'monospace', fontSize: '0.75rem', p: 0.5 }}>
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

const LanguageBox = ({ children, isMain, isAddButton, onClick, onLongPress }) => {
  const handlePress = (e, type) => {
    if (type === 'long') onLongPress?.(e)
    else onClick?.(e)
  }
  const longPressHandlers = useLongPress(handlePress, { delay: 500 })

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
  const [languages, setLanguages] = useState([])
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' })
  const [activeTooltip, setActiveTooltip] = useState(null)
  const tooltipTimerRef = useRef(null)

  // Initialize languages from shardData or detectedInfo
  useEffect(() => {
    let langs =
      // Edit mode: use shard data
      shardData?.data?.languages ||
      // Create mode: use detected info
      extractLanguage(detectedInfo)
    log.debug('🔍 Languages loaded:', langs)

    if (langs && langs.length > 0) {
      setLanguages(langs)
      onChange?.({ languages: langs })
    }
  }, [mode, detectedInfo, shardData?.data?.languages, onChange])

  const handleTooltipClick = (filename) => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }

    if (activeTooltip === filename) {
      setActiveTooltip(null)
    } else {
      setActiveTooltip(filename)
      tooltipTimerRef.current = setTimeout(() => {
        setActiveTooltip(null)
        tooltipTimerRef.current = null
      }, 4000)
    }
  }

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current)
      }
    }
  }, [])

  const handleLanguageToggle = (index) => {
    const langs = languages.map((lang, i) => ({ ...lang, isMain: i === index }))
    setLanguages(langs)
    onChange?.({ languages: langs })
  }

  const handleLanguageDelete = (index) => {
    const langs = languages.filter((_, i) => i !== index)
    if (languages[index].isMain && langs.length > 0) {
      langs[0].isMain = true
    }
    setLanguages(langs)
    onChange?.({ languages: langs })
  }

  const handleAddLanguage = () => {
    fileInputRef.current?.click()
  }

  const handleLanguageFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const buffer = await file.arrayBuffer()
      const detection = detect(file.name, buffer)
      
      if (!detection.match || detection.confidence < 0.5) {
        setErrorDialog({ 
          open: true, 
          message: 'The selected file is not a valid subtitle file. Please select a subtitle file (.srt, .vtt, .ass, etc.)' 
        })
        return
      }

      const language = detection.metadata.language
      
      // Check for duplicate language
      if (languages.find(lang => lang.code === language)) {
        setErrorDialog({ 
          open: true, 
          message: `${language.toUpperCase()} language is already added to this shard.` 
        })
        return
      }
      
      // Create new language entry
      const hasMain = languages.some(lang => lang.isMain)
      const movieName = hasMain 
        ? languages.find(lang => lang.isMain)?.movie_name || 'Unknown Movie'
        : detection.metadata?.movieName || 'Unknown Movie'

      const newLang = { 
        code: language, 
        isMain: !hasMain,
        filename: file.name,
        movie_name: movieName,
        file
      }
      
      const langs = [...languages, newLang]
      setLanguages(langs)
      onChange?.({ languages: langs })
      
    } catch (error) {
      log.error('❌ Failed to process language file:', error)
      setErrorDialog({ 
        open: true, 
        message: 'Failed to process the selected file. Please try again.' 
      })
    } finally {
      if (e.target) e.target.value = ''
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
          Subtitles
        </Typography>
        <Stack spacing={1}>
          {languages.map((lang, index) => {
            const filename = lang.filename || `${lang.code.toUpperCase()} subtitle file`
            
            return (
              <LanguageBox
                key={index}
                isMain={lang.isMain}
                onClick={() => handleLanguageToggle(index)}
                onLongPress={() => handleTooltipClick(filename)}
              >
                <Chip
                  variant={lang.isMain ? 'solid' : 'outlined'}
                  color="primary"
                  size="sm"
                  sx={{ 
                    minWidth: 40,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
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
                    '&:hover': { bgcolor: 'danger.100', color: 'danger.500' }
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </LanguageBox>
            )
          })}
          
          <LanguageBox isAddButton onClick={handleAddLanguage}>
            <Typography level="body-sm" color="neutral">
              + Add a subtitle
            </Typography>
          </LanguageBox>
        </Stack>
        <Typography level="body-xs" sx={{ mt: 1, color: 'text.tertiary' }}>
          Solid = Main language, Outlined = Reference. Press to select main, long press to view filename.
        </Typography>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.ass,.ssa,.sub"
          style={{ display: 'none' }}
          onChange={handleLanguageFileSelect}
        />
      </Box>

      <Box>
        <Typography level="body-sm" sx={{ mb: 2, color: 'primary.500', fontWeight: 'bold' }}>
          Pro Features
        </Typography>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Get movie poster</Typography>
            <Switch disabled size="md" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Match character names</Typography>
            <Switch disabled size="md" />
          </Box>
        </Stack>
      </Box>

      <Modal open={errorDialog.open} onClose={() => setErrorDialog({ open: false, message: '' })}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>Error</DialogTitle>
          <DialogContent>{errorDialog.message}</DialogContent>
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