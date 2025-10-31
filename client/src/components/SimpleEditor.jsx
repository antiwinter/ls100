import { useState, useEffect, useRef } from 'react'
import { Box, Textarea, IconButton, Chip } from '@mui/joy'
import { MicrophoneIcon, WaveformIcon } from '@phosphor-icons/react'
import { useRecordTools } from './RecordTools/index.js'
import { log } from '../utils/logger'

export const SimpleEditor = ({ html, onChange }) => {
  const [text, setText] = useState('')
  const [audioChips, setAudioChips] = useState([])
  const textareaRef = useRef(null)

  // Parse HTML on mount/change
  useEffect(() => {
    if (html) {
      parseHtml(html)
    }
  }, [html])

  // Parse HTML to extract text and audio chips
  const parseHtml = (htmlString) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlString, 'text/html')

    // Extract audio chips
    const audioElements = doc.querySelectorAll('audio-note')
    const chips = []
    audioElements.forEach(el => {
      chips.push({
        src: el.getAttribute('src'),
        duration: parseInt(el.getAttribute('data-duration') || '0')
      })
      el.remove()
    })
    setAudioChips(chips)

    // Extract text (after removing audio elements)
    const textContent = doc.body.textContent || ''
    setText(textContent)
  }

  // Build HTML from text and audio chips
  const buildHtml = (currentText, currentChips) => {
    let html = currentText ? `<p>${currentText.replace(/\n/g, '<br>')}</p>` : ''
    currentChips.forEach(chip => {
      html += `<audio-note src="${chip.src}" data-duration="${chip.duration}"></audio-note>`
    })
    return html
  }

  // Notify parent of changes
  const notifyChange = (newText, newChips) => {
    const html = buildHtml(newText, newChips)
    onChange?.(html)
  }

  // Handle text change
  const handleTextChange = (e) => {
    const newText = e.target.value
    setText(newText)
    notifyChange(newText, audioChips)
  }

  // Handle recording completion
  const handleRecordingComplete = (blob, duration) => {
    // Create object URL for the blob
    const objectUrl = URL.createObjectURL(blob)

    const newChip = {
      src: objectUrl,
      duration,
      blob // Keep reference for cleanup
    }

    const newChips = [...audioChips, newChip]
    setAudioChips(newChips)
    notifyChange(text, newChips)
  }

  // Setup recording tools
  const recordTools = useRecordTools({
    onRecordingComplete: handleRecordingComplete
  })

  // Play audio chip
  const handleChipClick = async (chip) => {
    try {
      const audio = new Audio(chip.src)
      audio.play()

      // Cleanup object URL after playback (only for blob URLs)
      if (chip.src.startsWith('blob:')) {
        audio.onended = () => {
          URL.revokeObjectURL(chip.src)
        }
      }
    } catch (error) {
      log.error('Failed to play audio:', error)
    }
  }

  // Handle backspace/delete on chips
  const handleKeyDown = (e) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && text === '' && audioChips.length > 0) {
      e.preventDefault()
      const newChips = audioChips.slice(0, -1)

      // Revoke object URL if it's a blob
      const removedChip = audioChips[audioChips.length - 1]
      if (removedChip.src.startsWith('blob:')) {
        URL.revokeObjectURL(removedChip.src)
      }

      setAudioChips(newChips)
      notifyChange(text, newChips)
    }
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
              onClick={() => handleChipClick(chip)}
              sx={{ cursor: 'pointer' }}
            >
              {chip.duration}″
            </Chip>
          ))}
        </Box>
      )}

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
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

