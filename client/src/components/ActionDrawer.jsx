import { useState, useRef, useEffect, memo,
  useCallback, forwardRef, useImperativeHandle } from 'react'
import { Box, Stack, Typography, IconButton } from '@mui/joy'
import { Close } from '@mui/icons-material'
import { useDrag } from '@use-gesture/react'
import { animate } from 'animejs'
import { log } from '../utils/logger'

const ANIMATION = 300
// Helper to prevent all pointer events from bubbling
const stopAllEvents = () => {
  const res = {}
  ;['onPointerDown', 'onPointerMove',
    'onPointerUp', 'onTouchStart',
    'onTouchMove', 'onTouchEnd',
    'onMouseDown', 'onMouseMove',
    'onMouseUp', 'onClick', 'onWheel']
    .forEach(k => {
      res[k] = (e) => {
        if (e.target.closest('[data-allow-events="true"]')) return
        // log.info('stopped Events', k, e)
        e.stopPropagation()
      }
    })
  return res
}

// Indicator: page indicator with imperative control
const Indicator = memo(forwardRef(({ pos = 'bottom', N = 0, _cur = 0, onChange }, ref) => {
  const [cur, setCur] = useState(_cur)

  // log.debug('Indicator re-render', { pos, N, _cur, onChange })
  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    setCursor: (i) => {
      setCur(i)
    }
  }), [])

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0.75,
        pb: pos === 'bottom' ? 0 : 1.5,
        pt: pos === 'top' ? 1 : 1.5
      }}
    >
      <Stack direction='row' spacing={0.75} alignItems='center'>
        {Array.from({ length: Math.max(N, 1) }).map((_, i) => (
          <Box
            key={i}
            onClick={() => onChange?.(i)}
            sx={{
              height: '6px',
              width: i === cur ? N > 1 ? '20px' : '40px' : '6px',
              borderRadius: '999px',
              bgcolor: i === cur ? 'neutral.400' : 'neutral.300',
              transition: 'all 0.25s ease',
              cursor: onChange ? 'pointer' : 'default'
            }}
          />
        ))}
      </Stack>
    </Box>
  )
}))

// Slider: horizontal page slider with imperative snapping API
const Slider = forwardRef(({ pages = [] }, ref) => {
  const slideRef = useRef(null)
  const pageRef = useRef(0)

  const _trans = useCallback((dx, animate = false) => {
    const w = slideRef.current.parentElement?.clientWidth || 0
    const st =  `translateX(${-pageRef.current * w + (dx || 0)}px)`

    if (slideRef.current) {
      slideRef.current.style.transition = animate ? 'transform 0.25s ease' : 'none'
      slideRef.current.style.transform = st
    }
    // log.debug('move slider', st)
    return st
  }, [])

  // Expose imperative snapping API
  useImperativeHandle(ref, () => ({
    trans: _trans,
    snap: (idx) => {
      // log.debug('snapping to', idx)
      pageRef.current = idx
      _trans()
    },
    resetScroll: () => {
      if (slideRef.current) {
        slideRef.current.querySelectorAll('[data-scrollable]').forEach(el => {
          el.scrollTop = 0
        })
      }
    }
  }))

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Box
        ref={slideRef}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          willChange: 'transform',
          minWidth: '100%',
          overscrollBehavior: 'contain' // Prevent any scroll chaining
        }}
      >
        {pages.map((p, i) => (
          <Box
            key={p.key ?? i}
            data-scrollable
            sx={{
              flex: '0 0 100%',
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              overscrollBehavior: 'contain', // Prevent scroll chaining
              WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
              touchAction: 'pan-y'
            }}
          >
            <Box sx={{ p: 2, minHeight: '100%' }}>
              {p.title && (
                <Typography level='title-sm' sx={{ mb: 1, color: 'neutral.500' }}>
                  {p.title}
                </Typography>
              )}
              {p.content ?? p}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
})

Slider.displayName = 'Slider'

// ActionDrawer: lite version with unified gesture handling and imperative API
export const ActionDrawer = forwardRef(({
  size,
  position = 'bottom',
  title,
  onPageChange,
  onClose,
  children
}, ref) => {
  // Internal state for content and navigation
  const [list, setList] = useState(null)
  const [drawer, setDrawer] = useState(null)

  // log.debug('ActionDrawer re-render', { title, pages: children, size })
  const pageRef = useRef(0)
  const sliderRef = useRef(null)
  const showRef = useRef(0)
  const bottomIndicatorRef = useRef(null)
  const topIndicatorRef = useRef(null)
  const bottom = position === 'bottom'

  // snap effect
  const to = useCallback((dy, duration = ANIMATION) => {
    // log.debug('drawer to', dy, duration)

    if (!drawer) {
      log.warn('not ready')
      return
    }

    // log.debug('animate', { y: `${isNaN(dy) ? dy : dy + 'px'}`, duration })
    animate(drawer, {
      translateY: `${isNaN(dy) ? dy : dy + 'px'}`,
      duration,
      easing: 'easeOutCubic',
      onComplete: () => {
        if (isNaN(dy) && duration)
          setList(null)
      }
    })
  }, [drawer])

  const _tryShow = useCallback((x) => {
    const st = showRef.current >> 1
    x ??= showRef.current & 1
    log.debug('try show', st, '>>', x)
    if (st == x) return

    if (drawer && x >= 0) {
      // log.debug('to', x)
      to(bottom ? '100%' : '-100%', x > 0 ? 0 : undefined)
      if (x > 0)  {
        // log.debug('showing')
        to(0)
      }
      showRef.current = x | (x << 1)
    } else {
      // log.debug('save state', x)
      showRef.current = x | (!x << 1)
    }
  }, [to, bottom, drawer])

  // Shared navigation logic
  const snap = useCallback((newPage) => {
    if (!list) return

    const p = Math.max(0, Math.min(list?.length - 1, newPage))
    // log.debug('ActionDrawer.nav', { p })
    pageRef.current = p
    onPageChange?.(p)
    // Update indicators
    bottomIndicatorRef.current?.setCursor(p)
    topIndicatorRef.current?.setCursor(p)
    sliderRef.current?.snap(p)
  }, [list, onPageChange])

  // Memoize pages normalization to prevent recreation on every render
  useEffect(() => {
    const l = [].concat(children)?.filter?.(Boolean)
      .map(p => p?.content ? p : { content: p })
    // log.debug({ l })

    if (l?.length)
      setList(l)

    // Auto-open/close based on content
    _tryShow(l?.length ? 1 : 0)
  }, [children, _tryShow])

  // Imperative API
  useImperativeHandle(ref, () => ({
    close: () => {
      // log.debug('ActionDrawer.close')
      _tryShow(0)
    },
    snap,
    resetScroll: () => {
      sliderRef.current?.resetScroll()
    }
  }), [snap, _tryShow])

  // const height = 300
  // const [{ y }, api] = useSpring(() => ({ y: height }))
  const debounce = useRef(0)
  const bind = useDrag(
    ({ last, velocity: [_vx, vy], direction: [_dx, dy], offset: [ox, oy], event }) => {
      const c = event.target.closest('[data-scrollable]')

      if (last) {
        let t1 = Date.now()
        // log.debug(t1, debounce.current)
        if (t1 - debounce.current < 20) return
        debounce.current = t1
      }
      // log.warn('drag info', { last, dy, oy, vy, _dx, ox, _vx } )
      // log.debug('target', event.target, c)

      // slide
      if (c) {
        if (!(list?.length > 1)) return

        if (last) {
          // log.debug('current page', page)
          if (ox > 30) snap(pageRef.current - 1)
          else if (ox < -30) snap(pageRef.current + 1)
          else {
            snap(pageRef.current)
          }
        } else
          sliderRef.current?.trans(ox)
        return
      }

      // manage drawer
      const _oy = bottom ? oy : -oy
      const height = drawer.parentElement?.clientHeight || 200

      if (last) {
        if (_oy > height * 0.5 || vy > 1) {
          _tryShow(1)
          onClose?.()
        } else
          _tryShow(0)
      }
      // when the user keeps dragging, we just move the sheet according to
      // the cursor position
      else {
        if ((dy < 1) ^ bottom)
          to(oy)
      }
    },
    { from: () => [0, 0],
      filterTaps: true
      // bounds: bottom ? { top: 0 } : { bottom: 0 },
      // rubberband: true
    }
  )

  // Return nothing if no content (after hooks)
  if (!list) {
    // log.warn('no list')
    return null
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        [bottom ? 'bottom' : 'top']: 0,
        display: 'flex',
        justifyContent: 'center',
        p: 0,
        zIndex: 1300,
        pointerEvents: 'none' // Allow clicks to pass through to content below
      }}
    >
      <Box
        ref={setDrawer}
        {...stopAllEvents()}
        {...bind()}
        sx={{
          bgcolor: 'background.body',
          pointerEvents: 'auto', // Drawer content should receive clicks
          borderRadius: bottom ? '24px 24px 0 0' : '0 0 24px 24px',
          width: 'calc(100% - 8px)',
          maxWidth: '500px',
          height: size || 'min(60vh, 300px)',
          maxHeight: '90vh',
          // position: 'fixed',
          boxShadow: t => (
            t.palette.mode === 'dark'
              ? '0 0 0 1px rgba(255,255,255,0.2), 0 0 10px rgba(159,248,217,0.7), 0 0 20px rgba(59,246,93,0.15)'
              : (
                bottom
                  ? '0 -8px 32px rgba(0,0,0,0.12), 0 -4px 16px rgba(0,0,0,0.08)'
                  : '0 8px 32px rgba(210, 71, 71, 0.12), 0 4px 16px rgba(0,0,0,0.08)'
              )
          ),
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overscrollBehavior: 'contain', // Prevent scroll chaining at root level
          touchAction: 'none'
        }}
      >
        {bottom && <Indicator ref={bottomIndicatorRef} pos='bottom' N={list.length} cur={pageRef.current} onChange={snap} />}

        {title && (
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            sx={{ px: 2, py: 1, borderBottom: bottom ? 1 : 0, borderTop: bottom ? 0 : 1, borderColor: 'divider' }}
          >
            {typeof title === 'string' || typeof title === 'number'
              ? <Typography level='h4'>{title}</Typography>
              : title}
            <IconButton size='sm' variant='plain' onClick={() => {
              _tryShow(0)
              onClose?.()
            }} sx={{ color: 'neutral.500' }}>
              <Close />
            </IconButton>
          </Stack>
        )}

        <Slider ref={sliderRef} pages={list} position={position} />

        {!bottom && <Indicator ref={topIndicatorRef} pos='top' N={list.length} cur={pageRef.current} onChange={snap} />}
      </Box>
    </Box>
  )
})

ActionDrawer.displayName = 'ActionDrawer'
