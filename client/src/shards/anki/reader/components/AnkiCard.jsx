import { useState, useRef } from 'react'
import { Box } from '@mui/joy'
import { detectPlatform } from '../../../../utils/useDetectPlatform.js'
import { useDrag } from '@use-gesture/react'
import { handleAudioClick, getAudioStyles } from './AudioHelper.js'

// AnkiCard component with flip animation and gesture-based drag
export const AnkiCard = ({
  content,
  front,
  back,
  onFlip,
  onExit,
  onDrag,
  css = null
}) => {
  const [isFlipping, setIsFlipping] = useState(false)
  const [currentSide, setCurrentSide] = useState('front') // 'front' | 'back'
  const [dragState, setDragState] = useState('none') // 'none' | 'left' | 'right'
  const [dragX, setDragX] = useState(0)
  const cardRef = useRef(null)

  // Platform detection for Anki CSS classes
  const getPlatformClasses = () => {
    if (typeof window === 'undefined') return 'card'

    const platform = detectPlatform()
    let classes = 'card'

    if (platform.isMobile) classes += ' mobile'
    if (platform.isIOS || platform.os === 'macos') classes += ' mac'

    return classes
  }

  // Handle flip animation and audio
  const handleCardClick = (e) => {
    // Handle audio player clicks first using helper
    if (handleAudioClick(e, cardRef)) return

    // Handle card flip if onFlip is provided
    if (!onFlip) return

    const nextSide = currentSide === 'front' ? 'back' : 'front'

    setIsFlipping(true)
    setTimeout(() => {
      setCurrentSide(nextSide)
      onFlip(nextSide)
      setTimeout(() => setIsFlipping(false), 150)
    }, 150)
  }

  // Drag handling with use-gesture
  const bind = useDrag(({ last, velocity: [vx], offset: [ox] }) => {
    if (last) {
      // Exit thresholds
      if ((Math.abs(ox) > 100 || Math.abs(vx) > 1) && onExit) {
        onExit(ox < 0 ? 'left' : 'right')
      } else {
        // Reset position
        setDragX(0)
        setDragState('none')
      }
    } else {
      // Update drag state during drag
      setDragX(ox)
      onDrag?.(ox)

      // Update drag state for glow effect
      const threshold = 50
      if (ox < -threshold) {
        setDragState('left')
      } else if (ox > threshold) {
        setDragState('right')
      } else {
        setDragState('none')
      }
    }
  })

  // Calculate transform styles
  const getTransform = () => {
    // Proportional scale: x=0 -> scale=1, x=±30 -> scale=0.9
    const scale = Math.max(0.9, 1 - Math.abs(dragX) * 0.1 / 30)

    // Proportional rotation: ±15° at ±100px drag
    const rotation = (dragX / 100) * 15

    let transform = `translateX(${dragX}px) scale(${scale}) rotateZ(${rotation}deg)`

    if (isFlipping) {
      transform += ` rotateY(${currentSide === 'back' ? 180 : 0}deg)`
    }

    return transform
  }

  // Calculate border glow and default shadow
  const getBorderGlow = () => {
    switch (dragState) {
    case 'left':
      return '0 0 20px var(--joy-palette-danger-400), 0 4px 20px rgba(0,0,0,0.15)'
    case 'right':
      return '0 0 20px var(--joy-palette-success-400), 0 4px 20px rgba(0,0,0,0.15)'
    default:
      return '0 4px 20px rgba(0,0,0,0.15), 0 8px 40px rgba(0,0,0,0.1)'
    }
  }

  return (
    <Box
      ref={cardRef}
      onClick={handleCardClick}
      {...bind()}
      className={getPlatformClasses()}
      sx={{
        // Fixed positioning - centered on screen
        position: 'fixed',
        top: '50%',
        left: '50%',
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
        boxShadow: getBorderGlow(),
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
        transform: `translate(-50%, -50%) ${getTransform()}`,
        transition: dragX !== 0 ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transformStyle: 'preserve-3d',
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
        },

        // Flip animation styles
        ...(isFlipping && {
          transform: `translate(-50%, -50%) ${getTransform()} rotateY(${currentSide === 'back' ? 180 : 0}deg)`,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        })

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
      {content && <div dangerouslySetInnerHTML={{ __html: content }} />}
      {front && back && (
        <div dangerouslySetInnerHTML={{
          __html: currentSide === 'front' ? front : back
        }} />
      )}
    </Box>
  )
}
