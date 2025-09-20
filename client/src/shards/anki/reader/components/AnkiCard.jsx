import { useState, useRef, useEffect } from 'react'
import { Box } from '@mui/joy'
import { detectPlatform } from '../../../../utils/useDetectPlatform.js'

// Helper to prevent drag events from bubbling to parent
const stopDragEvents = () => {
  const res = {}
  ;['onPointerDown', 'onPointerMove', 'onPointerUp',
    'onTouchStart', 'onTouchMove', 'onTouchEnd',
    'onMouseDown', 'onMouseMove', 'onMouseUp']
    .forEach(k => {
      res[k] = (e) => {
        e.stopPropagation()
      }
    })
  return res
}

// Sophisticated AnkiCard container with flip animation and drag support
export const AnkiCard = ({
  content,
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
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startTime = useRef(0)

  // Platform detection for Anki CSS classes
  const getPlatformClasses = () => {
    if (typeof window === 'undefined') return 'card'

    const platform = detectPlatform()
    let classes = 'card'

    if (platform.isMobile) classes += ' mobile'
    if (platform.isIOS || platform.os === 'macos') classes += ' mac'

    return classes
  }

  // Handle flip animation
  const handleCardClick = () => {
    if (isDragging.current || !onFlip) return

    const nextSide = currentSide === 'front' ? 'back' : 'front'

    setIsFlipping(true)
    setTimeout(() => {
      setCurrentSide(nextSide)
      onFlip(nextSide)
      setTimeout(() => setIsFlipping(false), 150)
    }, 150)
  }

  // Drag handlers
  const handleStart = (clientX) => {
    isDragging.current = false
    startX.current = clientX
    startTime.current = Date.now()
    setDragX(0)
    setDragState('none')
  }

  const handleMove = (clientX) => {
    if (startX.current === 0) return

    const deltaX = clientX - startX.current
    const deltaTime = Date.now() - startTime.current

    // Start dragging after minimum movement and time
    if (!isDragging.current && (Math.abs(deltaX) > 10 || deltaTime > 100)) {
      isDragging.current = true
    }

    if (!isDragging.current) return

    setDragX(deltaX)

    // Fire drag callback for real-time feedback
    if (onDrag) {
      onDrag(deltaX)
    }

    // Update drag state based on direction and distance
    const threshold = 50
    if (deltaX < -threshold) {
      setDragState('left')
    } else if (deltaX > threshold) {
      setDragState('right')
    } else {
      setDragState('none')
    }
  }

  const handleEnd = () => {
    if (!isDragging.current) {
      resetDrag()
      return
    }

    const threshold = 100

    if (dragX < -threshold && onExit) {
      onExit('left')
    } else if (dragX > threshold && onExit) {
      onExit('right')
    }

    resetDrag()
  }

  const resetDrag = () => {
    isDragging.current = false
    startX.current = 0
    setDragX(0)
    setDragState('none')
  }

  // Mouse events
  const handleMouseDown = (e) => {
    e.preventDefault()
    handleStart(e.clientX)
  }

  const handleMouseMove = (e) => {
    handleMove(e.clientX)
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  // Touch events
  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    handleStart(touch.clientX)
  }

  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    handleMove(touch.clientX)
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  // Global mouse move/up events
  useEffect(() => {
    if (startX.current === 0) return

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [startX.current]) // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate transform styles
  const getTransform = () => {
    let transform = `translateX(${dragX}px)`

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
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...stopDragEvents()}
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
        bgcolor: 'transparent',
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
        cursor: isDragging.current ? 'grabbing' : 'pointer',
        transform: `translate(-50%, -50%) ${getTransform()}`,
        transition: isDragging.current ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',

        // User selection
        userSelect: 'none',
        WebkitUserSelect: 'none',

        // Touch handling
        touchAction: 'none',

        // Content styling
        fontSize: '1.1rem',
        '& img': { maxWidth: '100%', height: 'auto' },
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

      {/* Drag indicators */}
      {dragState !== 'none' && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: dragState === 'left' ? '10%' : '90%',
            transform: 'translate(-50%, -50%)',
            fontSize: '2rem',
            color: dragState === 'left' ? 'danger.400' : 'success.400',
            opacity: Math.min(Math.abs(dragX) / 100, 1),
            transition: 'opacity 0.1s ease',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {dragState === 'left' ? '✕' : '✓'}
        </Box>
      )}
    </Box>
  )
}
