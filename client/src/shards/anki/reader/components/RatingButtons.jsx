import { Box, Stack, Button } from '@mui/joy'
import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import { useMemo, useRef, useEffect, useCallback } from 'react'
import { formatIntervalMs } from '../../../../utils/dateFormat.js'
import { animate } from 'animejs'
import { useDrag } from '@use-gesture/react'
import { log } from '../../../../utils/logger.js'

const ATIME_SNAP = 250
const ATIME_GLOW = 100
const BTN_WIDTH = 48
const BTN_MARGIN = 8

// Vertical rating buttons (right side). No labels, only intervals.
export const RatingButtons = ({ onRate, fsrs, glow, side: initialSide = 1 }) => {
  const sideRef = useRef(initialSide) // 1 / -1
  const containerRef = useRef(null)

  log.debug('RatingButtons', { fsrs, glow, side: initialSide })
  const engine = useMemo(() => new FSRS(), [])
  const nextByRating = useMemo(() => {
    const now = new Date()
    const base = fsrs || createEmptyCard(now.getTime())
    try {
      const next = engine.repeat(base, now)
      const nowMs = Date.now()
      const diff = ([1,2,3,4]).map(r => next[r].card.due - nowMs)
      log.debug('RatingButtons-nextByRating', {
        base, next, nowMs, diff })
      return next
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

  // Glow animation
  const refs = useRef({})
  const _glow = useCallback((glow, cb) => {
    const all = Object.values(refs.current).filter(Boolean)
    const elGlow = glow ? refs.current[glow] : null
    const entry = glow != null ? order.find(([rating]) => rating === glow) : undefined
    const shadowColor = entry ? entry[2] : undefined
    animate(all, {
      // scale: el => el === elGlow ? 1.08 : 1,
      boxShadow: el => el === elGlow && shadowColor ? `0 0 7px 2px ${shadowColor}` : '0 0 0 0 rgba(0,0,0,0)',
      duration: ATIME_GLOW,
      border: el => el === elGlow && '1px solid #fff',
      easing: 'easeOutCubic',
      onComplete: cb
    })
  }, [order])

  useEffect(() => {
    _glow(glow)
  }, [glow, _glow])

  const handleClick = useCallback((rating) => {
    onRate?.(rating)
    _glow(rating, () => {
      _glow(null)
    })
  }, [onRate, _glow])

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
          // log.debug('order', rating)
          if (rating === undefined)
            return <Box key={`gap-${index}`} sx={{ height: BTN_WIDTH }} />

          return (
            <Button
              key={rating}
              variant="soft"
              onClick={() => handleClick(rating)}
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
                ? formatIntervalMs(
                  Math.max(
                    0,
                    nextByRating[rating].card.due - Date.now()
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
