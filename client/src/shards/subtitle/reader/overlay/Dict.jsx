import { useEffect, useRef } from 'react'
import { 
  Stack,
  Typography,
  IconButton,
  Box
} from '@mui/joy'
import { VolumeUp } from '@mui/icons-material'
import { ActionDrawer } from '../../../../components/ActionDrawer.jsx'
import { log } from '../../../../utils/logger'
import DictCollins from '../../../../components/DictCollins.jsx'

// Dictionary component - simple props interface
export const Dict = ({ word, position = 'bottom', visible, onClose }) => {
  const scrollContainerRef = useRef(null)

  // Track drawer visibility changes
  useEffect(() => {
    if (visible && word) {
      log.debug(`📖 Dict drawer visible: ${word}`)
    }
  }, [visible, word])

  // Scroll to top when word changes (keep dict position but reset scroll)
  useEffect(() => {
    if (visible && word && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
      log.debug(`📖 Dict scrolled to top for new word: ${word}`)
    }
  }, [word, visible])

  // Data fetching is handled by DictCollins

  // Speech synthesis (cross-browser)
  const supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
  const voiceRef = useRef(null)
  const loadVoices = () => new Promise((resolve) => {
    if (!supportsTTS) return resolve([])
    const synth = window.speechSynthesis
    const existing = synth.getVoices()
    if (existing && existing.length) return resolve(existing)
    const handle = () => {
      const v = synth.getVoices()
      synth.removeEventListener?.('voiceschanged', handle)
      resolve(v || [])
    }
    synth.addEventListener?.('voiceschanged', handle)
    // Safari sometimes needs a tick
    setTimeout(() => handle(), 250)
  })

  const pickVoice = (voices) => {
    const english = voices.filter(v => /^en(-|_|$)/i.test(v.lang || ''))
    const prefer = [
      /en[-_]?US/i, // American
      /en[-_]?GB/i, // British
      /en/i
    ]
    for (const rule of prefer) {
      const v = english.find(x => rule.test(x.lang))
      if (v) return v
    }
    return english[0] || voices[0] || null
  }

  const ensureVoice = async () => {
    if (voiceRef.current || !supportsTTS) return voiceRef.current
    const voices = await loadVoices()
    voiceRef.current = pickVoice(voices)
    return voiceRef.current
  }

  const handlePlayAudio = async () => {
    if (!supportsTTS || !word) return
    try {
      const synth = window.speechSynthesis
      await ensureVoice()
      const u = new window.SpeechSynthesisUtterance(word)
      if (voiceRef.current) u.voice = voiceRef.current
      u.lang = voiceRef.current?.lang || 'en-US'
      u.rate = 0.95
      u.pitch = 1
      u.volume = 1
      // Safari sometimes queues paused; ensure resume
      synth.cancel()
      synth.resume?.()
      synth.speak(u)
    } catch (e) {
      log.error('TTS failed', e)
    }
  }

  // Dictionary content
  const renderContent = () => (
    <Stack spacing={1}>
      {/* Word header with phonetic and audio */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography level="h4">{word}</Typography>
        <IconButton
          size="sm"
          variant="plain"
          onClick={handlePlayAudio}
          sx={{ color: 'neutral.500' }}
          disabled={!supportsTTS}
        >
          <VolumeUp />
        </IconButton>
      </Stack>

      <DictCollins word={word} visible={visible} />
    </Stack>
  )

  return (
    <ActionDrawer
      open={visible}
      onClose={onClose}
      position={position}
      size="half"
    >
      <Box 
        ref={scrollContainerRef}
        sx={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          // Prevent scroll events from bubbling to parent
          touchAction: 'pan-y',
          // Enable elastic/bounce scrolling on iOS
          WebkitOverflowScrolling: 'touch',
          // Custom scrollbar styling
          scrollbarWidth: 'thin', // Firefox
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--joy-palette-neutral-300)',
            borderRadius: '3px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'var(--joy-palette-neutral-400)'
          }
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => {
          // Only stop propagation if we're actually scrolling within bounds
          const element = e.currentTarget
          const atTop = element.scrollTop === 0
          const atBottom = element.scrollTop >= element.scrollHeight - element.clientHeight
          
          // Get touch delta
          const touch = e.touches[0]
          const deltaY = touch.clientY - (element._lastTouchY || touch.clientY)
          element._lastTouchY = touch.clientY
          
          // Stop propagation if we're scrolling within the content bounds
          if ((!atTop && deltaY > 0) || (!atBottom && deltaY < 0)) {
            e.stopPropagation()
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation()
          delete e.currentTarget._lastTouchY
        }}
      >
        {renderContent()}
      </Box>
    </ActionDrawer>
  )
}