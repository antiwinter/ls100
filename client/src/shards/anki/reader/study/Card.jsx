import { useState, useRef, useEffect, useCallback,
  useImperativeHandle, forwardRef } from 'react'
import { Box } from '@mui/joy'
import { detectPlatform } from '../../../../utils/useDetectPlatform.js'
import { useDrag } from '@use-gesture/react'
import { handleAudioClick, getAudioStyles } from './AudioHelper.js'
import { animate } from 'animejs'
import { log } from '../../../../utils/logger.js'

const ATIME_EXIT = 300
const ATIME_FLIP = 1500
const hint_cap = 50

// SuperCard component with flip animation and gesture-based drag
export const SuperCard = forwardRef(({
  onFlip,
  onExit,
  onMove
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

  const getw = useCallback(() => {
    if (typeof window === 'undefined') return 1
    return window.innerWidth
  }, [])

  const move = useCallback(({ ox = 0, to = 0, delay = 0 }, cb = () => {}) => {
    const w = getw()
    if (!cardRef.current) return

    let boxShadow = '0 4px 20px rgba(0,0,0,0.15), 0 8px 40px rgba(0,0,0,0.1)'
    if (to < -hint_cap) {
      boxShadow = '0 0 20px var(--joy-palette-danger-400), 0 4px 20px rgba(0,0,0,0.15)'
    } else if (to > hint_cap) {
      boxShadow = '0 0 20px var(--joy-palette-success-400), 0 4px 20px rgba(0,0,0,0.15)'
    }
    cardRef.current.style.boxShadow = boxShadow

    const scale = 1 - Math.abs(to) * 0.3 / w
    const rotation = (to / w) * 7
    let duration = delay
    if (delay) {
      const a = Math.abs(ox)
      duration = (to ? (w - a) : a) / w * delay
    }
    if (delay)
      log.debug('to', { to, duration, delay, ox })

    // Animate transforms with anime.js
    animate(cardRef.current, {
      translateX: to,
      rotateZ: rotation,
      scale: scale,
      duration,
      easing: 'easeOutCubic',
      onComplete: cb
    })
  }, [getw])

  // Imperative API
  useImperativeHandle(ref, () => ({
    locknLoad: (dir, card) => {
      log.debug('locknLoad', { dir, card })

      const w = getw()
      // Exit with direction, then load new card
      move(
        {
          to: dir > 0 ? w : -w,
          delay: dir ? ATIME_EXIT : 0
        },
        () => {
          setCurrentSide('front')
          setLocked(card)
        })
    }
  }), [getw, move])

  // Animate card entrance when content changes (new card loaded)
  useEffect(() => {
    log.debug('useEffect', { locked })
    if (locked?.front || locked?.back) {
      // Start off-screen to the right, then animate in
      move({
        to: getw()
      },
      () => {
        move({
          ox: getw(),
          delay: ATIME_EXIT
        })
      })
    }
  }, [locked, move, getw])

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
      if ((Math.abs(ox) > 50 || Math.abs(vx) > 1)) {
        const w = getw()
        move(
          {
            to: ox < 0 ? -w : w,
            ox,
            delay: ATIME_EXIT
          },
          () => {
            log.debug('exit', { ox })
            onExit?.(ox)
          })
      } else {
        // reset position
        move({
          to: 0,
          ox,
          delay: ATIME_EXIT
        },
        () => {
          onMove?.(0)
          log.debug('card snap', { locked })
        })
      }
    } else {
      // track finger immediately (no animation)
      move({ to: ox })
      onMove?.(Math.abs(ox) > hint_cap ? ox : 0)
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
