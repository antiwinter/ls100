import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, Stack, Typography, IconButton } from '@mui/joy'
import { Close } from '@mui/icons-material'
import { log } from '../utils/logger'

const DEBUG = false

const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
const pt = e => ({
  x: e.touches?.[0]?.clientX ?? e.clientX,
  y: e.touches?.[0]?.clientY ?? e.clientY
})
const SIZES = {
  full: { h: '99vh', mh: '99vh' },
  half: { h: 'min(60vh, 300px)', mh: 'min(60vh, 300px)' },
  'fit-content': { h: 'auto', mh: '99vh' }
}

const Handle = ({ onDown, onMove, onUp, pos = 'bottom', pages = 0, page = 0 }) => (
  <Box
    sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.75, pb: pos === 'bottom' ? 0 : 1.5, pt: pos === 'top' ? 0 : 1.5, cursor: 'grab', touchAction: 'none', '&:active': { cursor: 'grabbing' } }}
    onTouchStart={e => { e.stopPropagation(); onDown(e) }}
    onTouchMove={e => { e.stopPropagation(); onMove(e) }}
    onTouchEnd={e => { e.stopPropagation(); onUp(e) }}
    onMouseDown={e => { e.stopPropagation(); onDown(e) }}
    onMouseMove={e => { e.stopPropagation(); onMove(e) }}
    onMouseUp={e => { e.stopPropagation(); onUp(e) }}
  >
    <Stack direction='row' spacing={0.75} alignItems='center' onClick={e => e.stopPropagation()}>
      {Array.from({ length: Math.max(pages, 1) }).map((_, i) => (
        <Box key={i} sx={{ height: '6px', width: i === page ? '20px' : '6px', borderRadius: '999px', bgcolor: i === page ? 'neutral.400' : 'neutral.300', transition: 'all 0.2s ease' }} />
      ))}
    </Stack>
  </Box>
)

const usePager = ({ open, contentRef, sliderRef, pages, initialPage = 0, onChange }) => {
  const list = Array.isArray(pages) ? pages.map(p => (p && typeof p === 'object' && 'content' in p) ? p : { content: p }) : []
  const cnt = list.length
  const [page, setPage] = useState(clamp(initialPage, 0, Math.max(0, cnt - 1)))
  const pageRef = useRef(page)
  const cntRef = useRef(cnt)
  const start = useRef({ x: 0, y: 0 })
  const wRef = useRef(1)
  const baseRef = useRef(0)
  const dxRef = useRef(0)
  const lockRef = useRef(null)
  const dragRef = useRef(false)
  const wheelTs = useRef(0)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const snap = useCallback((idx = pageRef.current) => {
    const w = contentRef.current?.clientWidth || 1
    wRef.current = w
    if (sliderRef.current) {
      sliderRef.current.style.transition = 'transform 0.25s ease'
      sliderRef.current.style.transform = `translateX(${-idx * w}px)`
    }
  }, [contentRef, sliderRef])

  const down = useCallback((x, y) => {
    if (!cntRef.current || !open) return
    dragRef.current = true
    start.current = { x, y }
    lockRef.current = null
    dxRef.current = 0
    wRef.current = contentRef.current?.clientWidth || 1
    baseRef.current = -pageRef.current * wRef.current
    if (sliderRef.current) sliderRef.current.style.transition = 'none'
  }, [contentRef, sliderRef, open])

  const move = useCallback((x, y, evt) => {
    if (!dragRef.current) return
    const dx = x - start.current.x
    const dy = y - start.current.y
    if (lockRef.current == null) {
      const ax = Math.abs(dx), ay = Math.abs(dy)
      if (ax > 8 || ay > 8) lockRef.current = ax > ay + 6 ? 'h' : 'v'
      if (DEBUG && lockRef.current) log.debug(`[drawer] lock ${lockRef.current}`, { dx, dy })
    }
    if (lockRef.current === 'h') {
      try { evt?.preventDefault() } catch { /* noop */ }
      evt?.stopPropagation?.()
      dxRef.current = dx
      if (sliderRef.current) sliderRef.current.style.transform = `translateX(${baseRef.current + dx}px)`
    }
  }, [sliderRef])

  const end = useCallback(() => {
    if (!dragRef.current) return
    const dx = dxRef.current
    const cur = pageRef.current
    const max = cntRef.current - 1
    let next = cur
    if (lockRef.current === 'h') {
      const th = 60
      if (dx > th && cur > 0) next = cur - 1
      else if (dx < -th && cur < max) next = cur + 1
    }
    if (DEBUG) log.debug('[drawer] end', { dx, from: cur, to: next })
    pageRef.current = next
    setPage(next)
    onChangeRef.current?.(next)
    dragRef.current = false
    lockRef.current = null
    dxRef.current = 0
    snap(next)
  }, [snap])

  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { cntRef.current = cnt }, [cnt])
  useEffect(() => {
    if (open && cnt) snap(pageRef.current)
  }, [open, cnt, snap])

  useEffect(() => {
    if (!open || !cnt) return
    let raf = 0
    let det
    const attach = () => {
      const n = contentRef.current
      if (!n) { raf = requestAnimationFrame(attach); return }
      const opt = { passive: false, capture: true }
      const pd = e => down(e.clientX, e.clientY)
      const pm = e => move(e.clientX, e.clientY, e)
      const pu = () => end()
      const ts = e => { const { x, y } = pt(e); down(x, y) }
      const tm = e => { const { x, y } = pt(e); move(x, y, e) }
      const te = () => end()
      const wh = e => {
        const now = Date.now()
        if (now - wheelTs.current < 400) return
        const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY)
        if (ax > ay + 5 && ax > 20) {
          try { e.preventDefault() } catch { /* noop */ }
          e.stopPropagation?.()
          const cur = pageRef.current
          const max = cntRef.current - 1
          let next = cur
          if (e.deltaX > 0 && cur < max) next = cur + 1
          if (e.deltaX < 0 && cur > 0) next = cur - 1
          if (next !== cur) {
            wheelTs.current = now
            pageRef.current = next
            setPage(next)
            onChangeRef.current?.(next)
            snap(next)
          }
        }
      }
      n.addEventListener('pointerdown', pd, opt)
      n.addEventListener('pointermove', pm, opt)
      n.addEventListener('pointerup', pu, opt)
      n.addEventListener('pointercancel', pu, opt)
      n.addEventListener('touchstart', ts, opt)
      n.addEventListener('touchmove', tm, opt)
      n.addEventListener('touchend', te, opt)
      n.addEventListener('wheel', wh, opt)
      if (DEBUG) log.debug('[drawer] listeners attached')
      det = () => {
        n.removeEventListener('pointerdown', pd, opt)
        n.removeEventListener('pointermove', pm, opt)
        n.removeEventListener('pointerup', pu, opt)
        n.removeEventListener('pointercancel', pu, opt)
        n.removeEventListener('touchstart', ts, opt)
        n.removeEventListener('touchmove', tm, opt)
        n.removeEventListener('touchend', te, opt)
        n.removeEventListener('wheel', wh, opt)
        if (DEBUG) log.debug('[drawer] listeners removed')
      }
    }
    raf = requestAnimationFrame(attach)
    return () => { if (raf) cancelAnimationFrame(raf); det?.() }
  }, [open, cnt, contentRef, snap, down, move, end])

  useEffect(() => {
    const onR = () => snap(pageRef.current)
    if (open && cnt) window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [open, cnt, snap])

  return { page, cnt, list, down, move, end }
}

export const ActionDrawer = ({ open, onClose = () => {}, size = 'half', position = 'bottom', title, content, children, pages, initialPage = 0, onPageChange }) => {
  const [dragY, setDragY] = useState(0)
  const [dragV, setDragV] = useState(false)
  const [render, setRender] = useState(false)
  const [enter, setEnter] = useState(false)
  const [pos, setPos] = useState(position)
  const [posChg, setPosChg] = useState(false)
  const drawRef = useRef(null)
  const contRef = useRef(null)
  const slideRef = useRef(null)
  const y0 = useRef(0)

  const pager = usePager({
    open,
    contentRef: contRef,
    sliderRef: slideRef,
    pages,
    initialPage,
    onChange: onPageChange
  })
  useEffect(() => {
    if (!open) return
    if (pager.cnt > 0 && slideRef.current) {
      slideRef.current.style.transition = 'transform 0.25s ease'
      slideRef.current.style.transform = 'translateX(0px)'
    }
  }, [open, pages, pager.cnt])

  const bottom = pos === 'bottom'
  const sz = SIZES[size] || SIZES.half

  const vStart = e => { setDragV(true); y0.current = pt(e).y; setDragY(0) }
  const vMove = e => {
    if (!dragV) return
    const y = pt(e).y
    const d = y - y0.current
    const forward = (bottom && d > 0) || (!bottom && d < 0)
    if (forward) setDragY(Math.abs(d))
  }
  const vEnd = () => {
    if (!dragV) return
    setDragV(false)
    if (dragY > 100 && typeof onClose === 'function') onClose()
    setDragY(0)
  }

  useEffect(() => {
    if (open) {
      setPos(position)
      setRender(true)
      setEnter(true)
      const t = setTimeout(() => setEnter(false), 50)
      return () => clearTimeout(t)
    } else {
      setEnter(false)
      const t = setTimeout(() => setRender(false), 400)
      return () => clearTimeout(t)
    }
  }, [open, position])

  useEffect(() => {
    if (position !== pos && open && !enter) {
      setPosChg(true)
      setPos(position)
      const t = setTimeout(() => setPosChg(false), 500)
      return () => clearTimeout(t)
    }
  }, [position, pos, open, enter])

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && open && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!render) return null

  const tr = () => {
    if (dragV) return `translateY(${bottom ? dragY : -dragY}px)`
    if (enter) return `translateY(${bottom ? '100%' : '-100%'})`
    if (!open) return `translateY(${bottom ? '100%' : '-100%'})`
    return `translateY(${bottom ? dragY : -dragY}px)`
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: bottom ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
        p: 0,
        pointerEvents: 'none',
        zIndex: 1300,
        transition: posChg
          ? 'align-items 0.5s cubic-bezier(0.25,0.46,0.45,0.94)'
          : 'none'
      }}
    >
      <Box
        ref={drawRef}
        onClick={e => e.stopPropagation()}
        sx={{
          bgcolor: 'background.body',
          pointerEvents: 'auto',
          borderRadius: bottom ? '24px 24px 0 0' : '0 0 24px 24px',
          width: 'calc(100% - 8px)',
          maxWidth: '500px',
          height: sz.h,
          maxHeight: sz.mh,
          transform: tr(),
          transition: dragV
            ? 'none'
            : (!open ? 'transform 0.4s ease-out' : 'transform 0.3s ease-in'),
          boxShadow: t => (
            t.palette.mode === 'dark'
              ? '0 0 0 1px rgba(255,255,255,0.2), 0 0 10px rgba(159,248,217,0.7), 0 0 20px rgba(59,246,93,0.15)'
              : (
                bottom
                  ? '0 -8px 32px rgba(0,0,0,0.12), 0 -4px 16px rgba(0,0,0,0.08)'
                  : '0 8px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)'
              )
          ),
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {bottom && (
          <Handle onDown={vStart} onMove={vMove} onUp={vEnd} pos='bottom' pages={pager.cnt} page={pager.page} />
        )}
        {title && (
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            sx={{ px: 2, py: 1, borderBottom: bottom ? 1 : 0, borderTop: bottom ? 0 : 1, borderColor: 'divider' }}
          >
            <Typography level='h4'>{title}</Typography>
            <IconButton size='sm' variant='plain' onClick={onClose} sx={{ color: 'neutral.500' }}>
              <Close />
            </IconButton>
          </Stack>
        )}
        <Box
          ref={contRef}
          sx={{
            flex: 1,
            p: pager.cnt ? 0 : 2,
            overflow: 'hidden',
            position: 'relative',
            overscrollBehaviorX: 'none'
          }}
        >
          {pager.cnt ? (
            <Box
              ref={slideRef}
              sx={{ height: '100%', display: 'flex', flexDirection: 'row', width: '100%', willChange: 'transform', minWidth: '100%' }}
              onClick={e => e.stopPropagation()}
            >
              {pager.list.map((p, i) => (
                <Box
                  key={p.key ?? i}
                  sx={{ flex: '0 0 100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y', pr: 0.5 }}
                  onClick={e => e.stopPropagation()}
                  onTouchMove={(e) => {
                    const el = e.currentTarget
                    const atTop = el.scrollTop === 0
                    const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight
                    const t = e.touches[0]
                    const dy = t.clientY - (el._lastTouchY || t.clientY)
                    el._lastTouchY = t.clientY
                    if ((!atTop && dy > 0) || (!atBottom && dy < 0)) e.stopPropagation()
                  }}
                  onTouchEnd={(e) => { delete e.currentTarget._lastTouchY }}
                >
                  <Box sx={{ p: 2, boxSizing: 'border-box', minHeight: '100%', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: 'var(--joy-palette-neutral-300)', borderRadius: '3px' }, '&::-webkit-scrollbar-thumb:hover': { background: 'var(--joy-palette-neutral-400)' } }}>
                    {p.title ? (
                      <Typography level='title-sm' sx={{ mb: 1, color: 'neutral.500' }}>
                        {p.title}
                      </Typography>
                    ) : null}
                    {p.content ?? p}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ height: '100%', overflow: 'hidden' }}>{content || children}</Box>
          )}
        </Box>
        {!bottom && (
          <Handle onDown={vStart} onMove={vMove} onUp={vEnd} pos='top' pages={pager.cnt} page={pager.page} />
        )}
      </Box>
    </Box>
  )
}
