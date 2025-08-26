import { useState, useRef } from 'react'
import { useMotionValue, useTransform } from 'framer-motion'
import { Box, Button } from '@mui/joy'

export const SwipeableButton = ({
  children,
  actions = [],
  onClick,
  maxSwipe = 140,
  threshold = 60
}) => {
  const [isRevealed, setIsRevealed] = useState(false)
  const x = useMotionValue(0)
  const containerRef = useRef(null)

  // Transform button widths based on swipe distance - immediate proportional reveal
  const actionCount = actions.length || 1
  const buttonWidth = maxSwipe / actionCount

  // Fixed number of transforms to avoid React Hook issues (max 5 actions)
  const width0 = useTransform(x, [-maxSwipe, 0], [buttonWidth, 0])
  const width1 = useTransform(x, [-maxSwipe, 0], [buttonWidth, 0])
  const width2 = useTransform(x, [-maxSwipe, 0], [buttonWidth, 0])
  const width3 = useTransform(x, [-maxSwipe, 0], [buttonWidth, 0])
  const width4 = useTransform(x, [-maxSwipe, 0], [buttonWidth, 0])

  const pos0 = useTransform(x, [-maxSwipe, 0], [0, 0])
  const pos1 = useTransform(x, [-maxSwipe, 0], [buttonWidth, 0])
  const pos2 = useTransform(x, [-maxSwipe, 0], [buttonWidth * 2, 0])
  const pos3 = useTransform(x, [-maxSwipe, 0], [buttonWidth * 3, 0])
  const pos4 = useTransform(x, [-maxSwipe, 0], [buttonWidth * 4, 0])

  const actionWidths = [width0, width1, width2, width3, width4]
  const actionPositions = [pos0, pos1, pos2, pos3, pos4]

  const handleDragEnd = (_, info) => {
    const shouldReveal = info.offset.x < -threshold

    if (shouldReveal && !isRevealed) {
      setIsRevealed(true)
      x.set(-maxSwipe)
    } else if (!shouldReveal && isRevealed) {
      setIsRevealed(false)
      x.set(0)
    } else if (isRevealed) {
      x.set(-maxSwipe)
    } else {
      x.set(0)
    }
  }

  const handleAction = (action) => {
    action?.()
    setIsRevealed(false)
    x.set(0)
  }

  const closeActions = () => {
    setIsRevealed(false)
    x.set(0)
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'background.surface',
        borderRadius: 'sm'
      }}
    >
      {/* Action buttons background */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: maxSwipe
        }}
      >
        {actions.map((action, index) => (
          <motion.div
            key={index}
            style={{
              position: 'absolute',
              right: actionPositions[index],
              top: 0,
              bottom: 0,
              width: actionWidths[index],
              overflow: 'hidden'
            }}
          >
            <Button
              variant="solid"
              color={action.color || 'neutral'}
              onClick={() => handleAction(action.action)}
              sx={{
                width: '100%',
                height: '100%',
                borderRadius: 0,
                fontSize: '12px',
                minWidth: 0,
                px: 1
              }}
            >
              {action.name}
            </Button>
          </motion.div>
        ))}
      </Box>

      {/* Draggable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -maxSwipe, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{
          x,
          backgroundColor: 'var(--joy-palette-background-surface)',
          cursor: isRevealed ? 'pointer' : 'grab',
          position: 'relative',
          zIndex: 1
        }}
        whileDrag={{ cursor: 'grabbing' }}
        onClick={isRevealed ? closeActions : onClick}
      >
        <Box sx={{
          p: 2,
          userSelect: 'none',
          bgcolor: 'background.surface',
          borderRadius: 'sm'
        }}>
          {children}
        </Box>
      </motion.div>
    </Box>
  )
}
