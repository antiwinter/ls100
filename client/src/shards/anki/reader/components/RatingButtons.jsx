import { Box, Stack, Button } from '@mui/joy'
import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import { useMemo, useRef, useEffect, useState } from 'react'
import { formatInterval } from '../../../../utils/dateFormat.js'
import { animate } from 'animejs'
import { useDrag } from '@use-gesture/react'

const ATIME_SNAP = 250
const ATIME_HINT = 250
const BTN_WIDTH = 48
const BTN_MARGIN = 8

// Vertical rating buttons (right side). No labels, only intervals.
export const RatingButtons = ({ onRate, fsrs, hint, side: initialSide = 1 }) => {
  const [side, setSide] = useState(initialSide) // 1 / -1
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

  // order: mapping to [colorToken, shadeNumber]
  const order = useMemo(() => ({
    [Rating.Easy]: ['success', 400],
    [Rating.Again]: ['danger', 400],
    [Rating.Hard]: ['warning', 400],
    [Rating.Good]: ['primary', 400]
  }), [])

  const nowMs = Date.now()

  // Hint glow animation
  const refs = useRef({})
  useEffect(() => {
    const all = Object.values(refs.current).filter(Boolean)
    const elHint = hint ? refs.current[hint] : null
    const entry = hint != null ? order?.[hint] : undefined
    const shadowColor = entry ? `var(--joy-palette-${entry[0]}-${entry[1]})` : undefined
    animate(all, {
      scale: el => el === elHint ? 1.08 : 1,
      boxShadow: el => el === elHint && shadowColor ? `0 0 18px 4px ${shadowColor}` : '0 0 0 0 rgba(0,0,0,0)',
      duration: ATIME_HINT,
      easing: 'easeOutCubic'
    })
  }, [hint, order])

  // snap effect
  useEffect(() => {
    const x = side < 0 ? BTN_MARGIN : window.innerWidth - BTN_MARGIN - BTN_WIDTH
    animate(containerRef?.current, {
      translateX: x,
      translateY: '-50%',
      duration: ATIME_SNAP,
      easing: 'easeOutCubic'
    })
  }, [side])

  // Drag handling per spec
  const bind = useDrag(({ last, velocity: [vx], offset: [ox, oy] }) => {
    const el = containerRef.current
    if (!el) return
    const w = window.innerWidth

    if (last) {
      if (vx * side < -1 || ox * side < -w / 2)
        setSide(x => -x)
    } else {
      // track finger both X and Y
      animate(el, {
        translateX: ox,
        translateY: `calc(-50% + ${oy}px)`,
        duration: 0
      })
    }
  }, {
    from: () => [0, 0],
    filterTaps: true,
    bounds: () => {
      // Convert to offset bounds relative to current rect
      return {
        left: BTN_MARGIN,
        right: window.innerWidth - BTN_MARGIN - BTN_WIDTH,
        top: 200, // doesn't matter, just a rough position
        bottom: window.innerHeight - BTN_MARGIN
      }
    },
    rubberband: true
  })

  return (
    <Box
      ref={containerRef}
      {...bind()}
      sx={{
        position: 'fixed',
        touchAction: 'none'
      }}
    >
      <Stack direction="column" spacing={1.5} alignItems="flex-end">
        {Object.entries(order).map(([ratingKey, [color]]) => {
          const rating = Number(ratingKey)
          return (
            <Button
              key={rating}
              variant="soft"
              color={color || 'neutral'}
              onClick={() => onRate?.(rating)}
              ref={(el) => { refs.current[rating] = el }}
              sx={{
                width: BTN_WIDTH,
                height: BTN_WIDTH,
                minWidth: BTN_WIDTH,
                borderRadius: '50%',
                p: 0,
                fontWeight: 'md'
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
