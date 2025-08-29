import { useRef, useState, useCallback, memo } from 'react'
import {
  Stack,
  Typography,
  IconButton,
  Box,
  Chip
} from '@mui/joy'
import { VolumeUp } from '@mui/icons-material'
import { log } from '../../utils/logger.js'
import { DictCollins } from '../DictCollins.jsx'

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
            // borderBottom: 1,
            // borderColor: 'divider',
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

// Main dictionary page with TTS functionality
export const DictMainPageComponent = ({ word }) => {
  const [pronunciation, setPronunciation] = useState('')
  const voiceRef = useRef(null)

  log.debug('DictMainPageComponent re-render', word)
  // Speech synthesis (cross-browser)
  const supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
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

  return (
    <DictMainPage
      word={word}
      pronunciation={pronunciation}
      supportsTTS={supportsTTS}
      onPlayAudio={handlePlayAudio}
      onMeta={handleMeta}
    />
  )
}

// Notes page component
export const DictNotesPage = ({ wordCtx }) => {
  if (!wordCtx) {
    return (
      <Box sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography level="body-md" sx={{ color: 'neutral.500' }}>
          Select a word to view context
        </Typography>
      </Box>
    )
  }

  const extractText = (line) => line?.data?.text || line?.text || ''

  return (
    <Box>
      <Stack spacing={2}>
        {/* Word and Context Chip */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography level="h4">
            {wordCtx.word}
          </Typography>
          <Chip variant='soft' size='sm' color='neutral' sx={{ fontSize: '0.75rem', color: 'neutral.400', px: 1 }}>
            Context
          </Chip>
        </Stack>

        {/* Main Language Context */}
        {wordCtx.main && wordCtx.main.length > 0 && (
          <Box>
            <Stack spacing={0.5}>
              {wordCtx.main.map((line, idx) => (
                <Typography
                  key={idx}
                  level="body-sm"
                  sx={{
                    lineHeight: 1.4
                  }}
                >
                  {extractText(line)}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {/* Reference Languages */}
        {wordCtx.refs && wordCtx.refs.size > 0 && (
          <Box>
            <Stack spacing={1.5}>
              {Array.from(wordCtx.refs.entries()).map(([langCode, lines]) => (
                lines.length > 0 && (
                  <Box key={langCode}>
                    <Typography level="body-xs" color="primary" sx={{ mb: 0.5, fontWeight: 600 }}>
                      {langCode.toUpperCase()}
                    </Typography>
                    <Stack spacing={0.5} sx={{ bgcolor: 'background.level1'
                      , px: 2, py: 1, borderRadius: 'md' }}>
                      {lines.map((line, idx) => (
                        <Typography
                          key={idx}
                          level="body-sm"
                          sx={{
                            lineHeight: 1.4,
                            color: 'secondary.400'
                          }}
                        >
                          {extractText(line)}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  )
}

// More page component
export const DictMorePage = () => {
  return (
    <Box sx={{
      height: '100%',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Typography level="body-md" sx={{ color: 'neutral.500' }}>
        Have a mind refresh...
      </Typography>
      <Box
        component="img"
        src="/freshpig.png"
        alt="Fresh pig"
        sx={{
          position: 'absolute',
          bottom: -250,
          left: '50%',
          // transform: 'translateX(-10%)',
          maxWidth: '30%',
          height: 'auto',
          objectFit: 'contain',
          opacity: 0.2
        }}
      />
    </Box>
  )
}
