import { useState, useRef, useEffect, useCallback,
  useImperativeHandle, forwardRef } from 'react'
import { Box } from '@mui/joy'
import { detectPlatform } from '../../../../utils/useDetectPlatform.js'
import { useDrag } from '@use-gesture/react'
import { handleAudioClick, getAudioStyles } from './AudioHelper.js'
import { animate } from 'animejs'
import { log } from '../../../../utils/logger.js'

const ATIME_EXIT = 1000
const ATIME_FLIP = 1500

// AnkiCard component with flip animation and gesture-based drag
export const AnkiCard = forwardRef(({
  onFlip,
  onExit,
  onDrag
}, ref) => {
  const [currentSide, setCurrentSide] = useState('front') // 'front' | 'back'
  const cardRef = useRef(null)
  const isFlipping = useRef(false)
  const [locked, setLocked] = useState(null) // Current locked card

  // Platform detection for Anki CSS classes
  const getPlatformClasses = () => {
    if (typeof window === 'undefined') return 'card'

    const platform = detectPlatform()
    let classes = 'card'

    if (platform.isMobile) classes += ' mobile'
    if (platform.isIOS || platform.os === 'macos') classes += ' mac'

    return classes
  }

  const w = window.innerWidth
  const to = useCallback((x, delay = ATIME_EXIT, cb = () => {}) => {
    if (!cardRef.current) return

    // log.debug('to', { x, delay })
    const threshold = 50
    let boxShadow = '0 4px 20px rgba(0,0,0,0.15), 0 8px 40px rgba(0,0,0,0.1)'
    if (x < -threshold) {
      boxShadow = '0 0 20px var(--joy-palette-danger-400), 0 4px 20px rgba(0,0,0,0.15)'
    } else if (x > threshold) {
      boxShadow = '0 0 20px var(--joy-palette-success-400), 0 4px 20px rgba(0,0,0,0.15)'
    }
    cardRef.current.style.boxShadow = boxShadow

    const scale = 1 - Math.abs(x) * 0.3 / w
    const rotation = (x / w) * 7
    const a = Math.abs(x)
    const duration = (x ? (w - a) : a) / w * delay

    // Animate transforms with anime.js
    animate(cardRef.current, {
      translateX: x,
      rotateZ: rotation,
      scale: scale,
      duration,
      easing: 'easeOutCubic',
      complete: cb
    })
  }, [w])

  // Imperative API
  useImperativeHandle(ref, () => ({
    locknLoad: (dir, card) => {
      log.debug('locknLoad', { dir, card })

      // Exit with direction, then load new card
      to(dir === 'right' ? w : -w, ATIME_EXIT, () => {
        setLocked(card)
      })
    }
  }), [w, to])

  // Animate card entrance when content changes (new card loaded)
  useEffect(() => {
    log.debug('useEffect', { locked })
    if (locked?.front || locked?.back) {
      // Start off-screen to the right, then animate in
      to(window.innerWidth, 0, () => {
        to(0, ATIME_EXIT)
      })
    }
  }, [locked, to])

  // Handle flip animation and audio
  const handleCardClick = (e) => {
    // Handle audio player clicks first using helper
    if (handleAudioClick(e, cardRef)) return

    const nextSide = currentSide === 'front' ? 'back' : 'front'

    if (isFlipping.current) return

    isFlipping.current = true
    // todo: start anime
    setTimeout(() => {
      setCurrentSide(nextSide)
      setTimeout(() => {
        onFlip(nextSide)
        isFlipping.current = false
      }
      , ATIME_FLIP / 2)
    }, ATIME_FLIP / 2)
  }

  // Drag handling with use-gesture and anime.js
  const bind = useDrag(({ last, velocity: [vx], offset: [ox] }) => {
    // log.debug('drag', { last, vx, ox, w })
    if (last) {
      // Exit thresholds
      if ((Math.abs(ox) > 150 || Math.abs(vx) > 1)) {
        to(ox < 0 ? -w : w, ATIME_EXIT,
          () => {
            log.debug('exit', { ox })
            onExit?.(ox < 0 ? 'left' : 'right')
          })
      } else {
        // reset position
        to(0, ATIME_EXIT, () => {
          log.debug('card snap', { locked })
          onDrag?.(0)
        })
      }
    } else {
      // track finger immediately (no animation)
      to(ox, 0)
      onDrag?.(ox)
    }
  },
  { from: () => [0, 0],
    filterTaps: true
    // bounds: bottom ? { top: 0 } : { bottom: 0 },
    // rubberband: true
  })

  return (
    <Box
      ref={cardRef}
      onClick={handleCardClick}
      {...bind()}
      className={getPlatformClasses()}
      sx={{
        // Fixed positioning - centered on screen
        position: 'fixed',
        top: '10vh',
        left: '10vw',
        zIndex: 1000,

        // Fixed dimensions
        width: '80vw',
        height: '80vh',
        overflowY: 'auto', // Ensure content doesn't bleed outside border radius

        // Card styling
        bgcolor: 'background.body',
        borderRadius: 'lg',
        // border: '2px solid',
        borderColor: 'neutral.outlinedBorder',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 8px 40px rgba(0,0,0,0.1)',

        // Reset margins to eliminate gaps
        m: 0,

        // Content layout and styling
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',

        // Animation and interaction
        cursor: 'pointer',
        backfaceVisibility: 'hidden',

        // User selection
        userSelect: 'none',
        WebkitUserSelect: 'none',

        // Touch handling
        touchAction: 'none',

        // Content styling
        fontSize: '1.1rem',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        '& img': { maxWidth: '100%', height: 'auto' },

        // Audio player styling from helper
        ...getAudioStyles(),

        '& .cloze-deletion': {
          bgcolor: 'warning.100',
          color: 'warning.800',
          px: 1.5,
          py: 0.75,
          borderRadius: 'sm',
          fontWeight: 'bold',
          fontSize: '1.1em'
        },
        '& .cloze-answer': {
          bgcolor: 'success.100',
          color: 'success.800',
          px: 1.5,
          py: 0.75,
          borderRadius: 'sm',
          fontWeight: 'bold',
          fontSize: '1.1em'
        }
        // Responsive adjustments
        // '@media (max-width: 768px)': {
        //   height: '85vh',
        //   width: '47.8125vh', // 85vh * 9/16
        //   maxWidth: '95vw'
        // }
      }}
    >
      {/* Inject bundle-scoped CSS if available */}
      {locked?.css && <style>{locked.css}</style>}

      {/* Content */}
      {locked && (
        <div style={{ padding: '20px' }} dangerouslySetInnerHTML={{
          __html: currentSide === 'front' ? locked.front : locked.back
        }} />
      )}
    </Box>
  )
})
