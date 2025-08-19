import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react'
import {
  Stack,
  Typography,
  IconButton,
  Box
} from '@mui/joy'
import { VolumeUp } from '@mui/icons-material'
import { ActionDrawer } from '../../../../components/ActionDrawer.jsx'
import { log } from '../../../../utils/logger'
import { DictCollins } from '../../../../components/DictCollins.jsx'

// First page content (scrollable) extracted as a memoized component
const DictMainPage = memo(function DictMainPage ({
  word,
  pronunciation,
  supportsTTS,
  onPlayAudio,
  onMeta
}) {
  return (
    <Box>
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            mb: 0.5,
            position: 'sticky',
            top: 0,
            zIndex: 2,
            bgcolor: 'background.body',
            borderBottom: 1,
            borderColor: 'divider',
            py: 0.5
          }}
        >
          <Typography level="h4">{word}</Typography>
          {!!pronunciation && (
            <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
              /{pronunciation}/
            </Typography>
          )}
          <IconButton
            size="sm"
            variant="plain"
            onClick={onPlayAudio}
            sx={{ color: 'neutral.500' }}
            disabled={!supportsTTS}
          >
            <VolumeUp />
          </IconButton>
        </Stack>
        <DictCollins word={word} onMeta={onMeta} />
      </Stack>
    </Box>
  )
})

// Dictionary component - simple props interface
const Dict_ = ({ word, position = 'bottom', visible, onClose }) => {
  const [pronunciation, setPronunciation] = useState('')
  const drawerRef = useRef(null)

  // log.debug('Dict re-render', { word, position, onClose })

  // Track drawer visibility changes
  useEffect(() => {
    if (word) {
      log.debug(`📖 Dict drawer visible: ${word}`)
    }
  }, [word])

  // Speech synthesis (cross-browser)
  const supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
  const voiceRef = useRef(null)
  const loadVoices = useCallback(() => new Promise((resolve) => {
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
  }), [supportsTTS])

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

  // inline ensure logic inside handler to avoid extra function deps

  const handlePlayAudio = useCallback(async () => {
    if (!supportsTTS || !word) return
    try {
      const synth = window.speechSynthesis
      await (async () => {
        if (!voiceRef.current) {
          const v = await loadVoices()
          voiceRef.current = pickVoice(v)
        }
      })()
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
  }, [supportsTTS, word, loadVoices])

  // Stable onMeta handler to avoid re-renders in Memoized DictCollins
  const handleMeta = useCallback((meta) => {
    const next = meta?.pronunciation || ''
    setPronunciation(prev => (prev === next ? prev : next))
  }, [])

  const pages = useMemo(() => ([{
    content: (
      <DictMainPage
        word={word}
        pronunciation={pronunciation}
        supportsTTS={supportsTTS}
        onPlayAudio={handlePlayAudio}
        onMeta={handleMeta}
      />
    )
  }, {
    title: 'Notes',
    content: (
      <Box sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
        // p: 2
      }}>
        <Typography level="body-md" sx={{ color: 'neutral.500' }}>
          Notes are coming soon
        </Typography>
      </Box>
    )
  }, {
    title: 'More',
    content: (
      <Box sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
        // p: 8
      }}>
        <Typography level="body-md" sx={{ color: 'neutral.500' }}>
          Third page placeholder
        </Typography>
      </Box>
    )
  }]), [word, handleMeta, handlePlayAudio, pronunciation, supportsTTS])

  // Handle drawer visibility with imperative API
  useEffect(() => {
    if (visible && word && pages.length > 0) {
      log.debug('📖 Opening dict drawer', { word })
      drawerRef.current?.open(pages)
      drawerRef.current?.snap(0)
      drawerRef.current?.resetScroll()
    } else if (!visible) {
      log.debug('📖 Closing dict drawer')
      drawerRef.current?.close()
    }
  }, [visible, word, pages])

  log.info('Dict re-render', { visible: !!visible, word, position, pages: pages.length })
  return (
    <ActionDrawer
      ref={drawerRef}
      onClose={onClose}
      position={position}
      size="half"
    />
  )
}

export const Dict = memo(Dict_)
