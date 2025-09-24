import { Box, Stack, Button } from '@mui/joy'
import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import { useMemo, useRef, useEffect, useCallback } from 'react'
import { formatInterval } from '../../../../utils/dateFormat.js'
import { animate } from 'animejs'
import { useDrag } from '@use-gesture/react'
import { log } from '../../../../utils/logger.js'

const ATIME_SNAP = 250
const ATIME_HINT = 250
const BTN_WIDTH = 48
const BTN_MARGIN = 8

// Vertical rating buttons (right side). No labels, only intervals.
export const RatingButtons = ({ onRate, fsrs, hint, side: initialSide = 1 }) => {
  const sideRef = useRef(initialSide) // 1 / -1
  const containerRef = useRef(null)

  const engine = useMemo(() => new FSRS(), [])
  const nextByRating = useMemo(() => {
    const now = new Date()
    const base = (fsrs && fsrs[0]) || createEmptyCard(now.getTime())
    try {
      return engine.repeat(base, now)
    } catch {
      return null
    }
  }, [fsrs, engine])

  // order: array of [rating, buttonColor, shadowColor]
  const order = useMemo(() => [
    [Rating.Easy, '#2196F3', '#42A5F5'],     // Blue
    [],
    [Rating.Again, '#f44336', '#EF5350'],   // Red
    [Rating.Hard, '#FF9800', '#FFB74D'],    // Orange/Yellow
    [Rating.Good, '#4CAF50', '#66BB6A']    // Green
  ], [])

  const nowMs = Date.now()

  // Hint glow animation
  const refs = useRef({})
  useEffect(() => {
    const all = Object.values(refs.current).filter(Boolean)
    const elHint = hint ? refs.current[hint] : null
    const entry = hint != null ? order.find(([rating]) => rating === hint) : undefined
    const shadowColor = entry ? entry[2] : undefined
    animate(all, {
      scale: el => el === elHint ? 1.08 : 1,
      boxShadow: el => el === elHint && shadowColor ? `0 0 18px 4px ${shadowColor}` : '0 0 0 0 rgba(0,0,0,0)',
      duration: ATIME_HINT,
      easing: 'easeOutCubic'
    })
  }, [hint, order])

  // snap effect
  const to = useCallback(() => {
    const x = sideRef.current < 0 ? BTN_MARGIN : window.innerWidth - BTN_MARGIN - BTN_WIDTH
    log.debug('snap', { x, y: window.innerHeight / 4 })
    animate(containerRef?.current, {
      top: window.innerHeight / 3,
      left: x,
      translateX: 0,
      translateY: 0,
      duration: ATIME_SNAP,
      easing: 'easeOutCubic'
    })
  }, [])
  useEffect(() => {
    to()
  }, [to])

  // Drag handling per spec
  const bind = useDrag(({ last, velocity: [vx], offset: [ox, oy] }) => {
    const el = containerRef.current
    if (!el) return
    const w = window.innerWidth

    if (last) {
      const side = sideRef.current
      // log.debug('last', { vx, ox, side, w })
      if (vx * side < -1
        || ox * side < -w / 3)
        sideRef.current = -side
      to()
    } else {
      // track finger both X and Y
      // log.debug('track', { ox, oy })
      // debugOyStats(oy)
      animate(el, {
        translateX: ox,
        translateY: oy,
        duration: 0
      })
    }
  }, {
    from: () => [0, 0],
    filterTaps: true,
    // bounds: () => {
    //   // Convert to offset bounds relative to current rect
    //   return {
    //     left: BTN_MARGIN,
    //     right: window.innerWidth - BTN_MARGIN - BTN_WIDTH,
    //     top: 200, // doesn't matter, just a rough position
    //     bottom: window.innerHeight - BTN_MARGIN
    //   }
    // },
    rubberband: true
  })

  return (
    <Box
      ref={containerRef}
      {...bind()}
      sx={{
        position: 'fixed',
        touchAction: 'none',
        zIndex: 1001
      }}
    >
      <Stack direction="column" spacing={1.5} alignItems="flex-end">
        {order.map(([rating, color], index) => {
          log.debug('order', rating)
          if (rating === undefined)
            return <Box key={`gap-${index}`} sx={{ height: BTN_WIDTH }} />

          return (
            <Button
              key={rating}
              variant="soft"
              onClick={() => onRate?.(rating)}
              ref={(el) => { refs.current[rating] = el }}
              sx={{
                width: BTN_WIDTH,
                height: BTN_WIDTH,
                minWidth: BTN_WIDTH,
                borderRadius: '50%',
                p: 0,
                fontWeight: 'md',
                color: 'white',
                backgroundColor: `${color}B3`, // 70% opacity for glass effect
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
            >
              {nextByRating?.[rating]?.card?.due
                ? formatInterval(
                  Math.max(
                    0,
                    nextByRating[rating].card.due - nowMs
                  )
                )
                : ''}
            </Button>
          )
        })}
      </Stack>
    </Box>
  )
}
