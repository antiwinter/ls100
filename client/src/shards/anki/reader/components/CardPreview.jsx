import { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/joy'

export const CardPreview = ({ renderer, card, side = 'back' }) => {
  const [rendered, setRendered] = useState(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (!renderer || !card) { setRendered(null); return }
    const id = ++reqIdRef.current
    ;(async () => {
      try {
        const r = await renderer.render(card)
        if (reqIdRef.current === id) setRendered(r)
      } catch {
        if (reqIdRef.current === id) setRendered(null)
      }
    })()
  }, [renderer, card])

  return (
    <Box sx={{
      p: 2,
      border: 1,
      borderColor: 'divider',
      borderRadius: 'md',
      bgcolor: 'background.body',
      overflow: 'hidden',
      '& img': { maxWidth: '100%', height: 'auto' }
    }}>
      {rendered
        ? <div dangerouslySetInnerHTML={{ __html: side === 'back' ? (rendered.back || '') : (rendered.front || '') }} />
        : <Typography level="body-sm" color="neutral">Loading…</Typography>}
    </Box>
  )
}
