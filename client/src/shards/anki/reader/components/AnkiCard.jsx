import { useState, useRef } from 'react'
import { Box } from '@mui/joy'
import { detectPlatform } from '../../../../utils/useDetectPlatform.js'
import { useDrag } from '@use-gesture/react'
import { handleAudioClick, getAudioStyles } from './AudioHelper.js'
import { animate } from 'animejs'
import { log } from '../../../../utils/logger.js'

const ATIME_EXIT = 1000
const ATIME_FLIP = 1500

// AnkiCard component with flip animation and gesture-based drag
export const AnkiCard = ({
  front,
  back,
  onFlip,
  onExit,
  onDrag,
  css = null
}) => {
  const [currentSide, setCurrentSide] = useState('front') // 'front' | 'back'
  const cardRef = useRef(null)
  const isFlipping = useRef(false)
  // Platform detection for Anki CSS classes
  const getPlatformClasses = () => {
    if (typeof window === 'undefined') return 'card'

    const platform = detectPlatform()
    let classes = 'card'

    if (platform.isMobile) classes += ' mobile'
    if (platform.isIOS || platform.os === 'macos') classes += ' mac'

    return classes
  }

  const to = (ox, delay = ATIME_EXIT, cb = () => {}) => {
    if (!cardRef.current) return

    log.debug('to', { ox, delay })
    const threshold = 50
    let boxShadow = '0 4px 20px rgba(0,0,0,0.15), 0 8px 40px rgba(0,0,0,0.1)'
    if (ox < -threshold) {
      boxShadow = '0 0 20px var(--joy-palette-danger-400), 0 4px 20px rgba(0,0,0,0.15)'
    } else if (ox > threshold) {
      boxShadow = '0 0 20px var(--joy-palette-success-400), 0 4px 20px rgba(0,0,0,0.15)'
    }
    cardRef.current.style.boxShadow = boxShadow

    const win = window.innerWidth / 2
    const scale = 1 - Math.abs(ox) * 0.3 / win
    const rotation = (ox / win) * 7

    // Animate transforms with anime.js
    animate(cardRef.current, {
      translateX: ox,
      rotateZ: rotation,
      scale: scale,
      duration: delay,
      easing: 'easeOutCubic',
      complete: cb
    })
  }

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
    log.debug('drag', { last, vx, ox, win: window.innerWidth })
    if (last) {
      // Exit thresholds
      const x =  ox > 0 ? window.innerWidth : -window.innerWidth
      if ((Math.abs(ox) > 150 || Math.abs(vx) > 1)) {
        to(x,
          (x - ox) / x * ATIME_EXIT,
          () => {
            onExit?.(ox < 0 ? 'left' : 'right')
          })
      } else {
        // reset position
        to(0, ox / x * ATIME_EXIT)
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
        maxWidth: '80vw',
        maxHeight: '95vh',

        // Card styling
        bgcolor: 'background.body',
        borderRadius: 'lg',
        // border: '2px solid',
        borderColor: 'neutral.outlinedBorder',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 8px 40px rgba(0,0,0,0.1)',
        overflow: 'hidden', // Ensure content doesn't bleed outside border radius

        // Reset margins to eliminate gaps
        m: 0,

        // Content layout and styling
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        p: 3, // Default padding for content readability

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
      {css && <style>{css}</style>}

      {/* Content */}
      {front && back && (
        <div dangerouslySetInnerHTML={{
          __html: currentSide === 'front' ? front : back
        }} />
      )}
    </Box>
  )
}
