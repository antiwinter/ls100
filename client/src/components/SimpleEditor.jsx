import { useState, useEffect, useRef } from 'react'
import { Box, Textarea, IconButton, Chip, Menu, MenuItem, ListItemDecorator } from '@mui/joy'
import { MicrophoneIcon, WaveformIcon, PlayIcon, TextAaIcon, TrashIcon } from '@phosphor-icons/react'
import { useRecordTools } from './RecordTools/index.js'
import { log } from '../utils/logger'

export const SimpleEditor = ({ html, onChange }) => {
  const [text, setText] = useState('')
  const [audioChips, setAudioChips] = useState([])
  const [menuAnchor, setMenuAnchor] = useState(null)
  const chipRef = useRef(null)
  const textareaRef = useRef(null)

  // Parse HTML on mount/change
  useEffect(() => {
    if (!html) return
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Extract audio chips
    const audioElements = doc.querySelectorAll('audio-note')
    const chips = []
    audioElements.forEach(el => {
      const src = el.getAttribute('src')
      const audio = new Audio(src)
      chips.push({
        src,
        duration: parseInt(el.getAttribute('data-duration') || '0'),
        audio
      })
      el.remove()
    })
    setAudioChips(chips)

    // Extract text (after removing audio elements)
    const textContent = doc.body.textContent || ''
    setText(textContent)
  }, [html])

  // Build HTML from text and audio chips
  const buildHtml = (currentText, currentChips) => {
    let html = currentText ? `<p>${currentText.replace(/\n/g, '<br>')}</p>` : ''
    currentChips.forEach(chip => {
      const dataFilename = chip.filename ? ` data-filename="${chip.filename}"` : ''
      html += `<audio-note src="${chip.src}" data-duration="${chip.duration}"${dataFilename}></audio-note>`
    })
    return html
  }

  // Build blob map from chips (only blob URLs, not /oss/ URLs)
  const buildBlobMap = (currentChips) => {
    const blobs = {}
    currentChips.forEach(chip => {
      if (chip.blob && chip.filename) {
        blobs[chip.filename] = chip.blob
      }
    })
    return blobs
  }

  useEffect(() => {
    const html = buildHtml(text, audioChips)
    const blobs = buildBlobMap(audioChips)
    onChange?.(html, blobs)
  }, [text, audioChips, onChange])

  // Handle text change
  const handleTextChange = (e) => {
    const newText = e.target.value
    setText(newText)
  }

  // Handle recording completion
  const handleRecordingComplete = (blob, duration) => {
    // Create object URL for the blob
    const objectUrl = URL.createObjectURL(blob)

    // Generate filename from blob type
    const ext = blob.type.split('/')[1] || 'webm'
    const filename = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`

    // Create audio element
    const audio = new Audio(objectUrl)

    const newChip = {
      src: objectUrl,
      duration,
      blob,
      filename,
      audio
    }

    const newChips = [...audioChips, newChip]
    setAudioChips(newChips)
  }

  // Setup recording tools
  const recordTools = useRecordTools({
    onRecordingComplete: handleRecordingComplete
  })

  // Handle context menu on chip
  const handleChipContextMenu = (e, chip) => {
    e.preventDefault()
    setMenuAnchor(e.currentTarget)
    chipRef.current = chip
  }

  // Close context menu
  const handleMenuClose = () => {
    setMenuAnchor(null)
    chipRef.current = null
  }

  // Toggle play/pause audio chip
  const handlePlay = (chip) => {
    if (!chip?.audio) return
    try {
      if (chip.audio.paused) {
        chip.audio.play()
      } else {
        chip.audio.pause()
      }
    } catch (error) {
      log.error('Failed to play/pause audio:', error)
    }
  }

  // Handle play from menu
  const handlePlayFromMenu = () => {
    const chip = chipRef.current
    handlePlay(chip)
    handleMenuClose()
  }

  // Convert to text (placeholder)
  const handleConvertToText = () => {
    log.debug('Convert to text - placeholder')
    handleMenuClose()
  }

  // Delete chip
  const handleDelete = () => {
    const chip = chipRef.current
    if (!chip) return

    const newChips = audioChips.filter(c => c.filename !== chip.filename)

    // Cleanup: pause and revoke
    if (chip.audio) {
      chip.audio.pause()
      chip.audio.src = '' // Release audio resource
    }
    if (chip.src?.startsWith?.('blob:'))
      URL.revokeObjectURL(chip.src)

    setAudioChips(newChips)
    handleMenuClose()
  }

  return (
    <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Recording Overlay (via portal) */}
      {recordTools.overlay}

      {/* Audio Chips */}
      {audioChips.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {audioChips.map((chip, idx) => (
            <Chip
              key={idx}
              variant="soft"
              color="primary"
              startDecorator={<WaveformIcon size={16} />}
              onClick={() => handlePlay(chip)}
              onContextMenu={(e) => handleChipContextMenu(e, chip)}
              sx={{ cursor: 'pointer' }}
            >
              {chip.duration}″
            </Chip>
          ))}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        placement="bottom-start"
      >
        <MenuItem onClick={handlePlayFromMenu}>
          <ListItemDecorator>
            <PlayIcon size={16} />
          </ListItemDecorator>
          Play
        </MenuItem>
        <MenuItem onClick={handleConvertToText}>
          <ListItemDecorator>
            <TextAaIcon size={16} />
          </ListItemDecorator>
          Convert to text
        </MenuItem>
        <MenuItem onClick={handleDelete} color="danger">
          <ListItemDecorator>
            <TrashIcon size={16} />
          </ListItemDecorator>
          Delete
        </MenuItem>
      </Menu>

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        placeholder="Type your notes here..."
        minRows={8}
        maxRows={20}
        sx={{ flexGrow: 1 }}
      />

      {/* Recording Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <IconButton
          size="lg"
          {...recordTools.buttonProps}
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%'
          }}
        >
          <MicrophoneIcon size={32} weight={recordTools.isRecording ? 'fill' : 'regular'} />
        </IconButton>
      </Box>
    </Box>
  )
}

