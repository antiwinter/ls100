import { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/joy'
import { ankiClasses } from '../utils/cssTools'

export const CardPreview = ({ renderer, card, side = 'back', width, height }) => {
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

  // Render card at 330x932 aspect ratio, then scale to fit
  const CARD_WIDTH = 330
  const CARD_HEIGHT = 932
  const scale = Math.max(width / CARD_WIDTH, height / CARD_HEIGHT)
  return (
    <Box sx={{
      width: width,
      height: height,
      border: 1,
      borderColor: 'divider',
      borderRadius: 'md',
      bgcolor: 'background.body',
      overflow: 'hidden',
      flexShrink: 0,
      p: 0
    }}>
      {rendered ? (
        <>
          <Box
            className={ankiClasses()}
            sx={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              p: '1em !important',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              '& .anki-audio': {
                display: 'inline-flex',
                mr: 3
              }
            }}
            dangerouslySetInnerHTML={{
              __html: side === 'front' ? rendered.front : rendered.back
            }}
          />
        </>
      ) : (
        <Typography level="body-sm" color="neutral">Loading…</Typography>
      )}
    </Box>
  )
}
