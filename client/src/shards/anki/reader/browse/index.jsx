import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/joy'
import { Grid } from 'react-window'
import Fuse from 'fuse.js'
import anki from '../../core/index.js'
import db from '../../core/db.js'
import { BrowserTools } from './tools.jsx'
import { log } from '../../../../utils/logger'
import { CardPreview } from './CardPreview.jsx'
import _ from 'lodash'


export const Browser = ({ prefs, session }) => {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [renderer, setRenderer] = useState(null)
  const [cards, setCards] = useState([])
  const [cw, setGridWidth] = useState(0)

  const styleRef = useRef(null)
  const toolsRef = useRef(null)
  const skipRangeChange = useRef(0)

  const { bundleId, searchQuery, shard } = session()
  const { previewSide: side } = prefs()

  const handleEmptyClick = useCallback((_e) => {
    // log.debug('handleEmptyClick', _e.target)
    toolsRef.current?.toggleToolbar()
  }, [])

  const handleRangeChange = useCallback(() => {
    // Skip range changes after cards update (typing)
    if (skipRangeChange.current > 0) {
      skipRangeChange.current--
      return
    }

    toolsRef.current?.closeTools()
  }, [])

  const fuse = useMemo(() => {
    if (!data.length) return null
    return new Fuse(data, {
      includeScore: true,
      threshold: 0.3,
      keys: ['text']
    })
  }, [data])

  useEffect(() => {
    if (!bundleId) {
      setRenderer('error')
      return
    }

    let alive = true
    ;(async () => {
      try {
        const notes = _.keyBy(await db.notes.where('bundleId')
          .equals(bundleId).toArray(), 'id')
        const _cards = (await anki.getCardsForBundles([bundleId]))
          .map(c => {
            c.text = notes[c.noteId]?.fields?.join(',') || ''
            return c
          })
        const rctx = await anki.createRender(_cards)
        if (!rctx) throw new Error('Failed to create render')

        if (alive) {
          setData(_cards)
          setRenderer(rctx)
          if (rctx.css) {
            styleRef.current = document.createElement('style')
            styleRef.current.textContent = rctx.css
            document.head.appendChild(styleRef.current)
          }
        }
      } catch (err) {
        log.error('Error:', err)
        if (alive) setRenderer('error')
      }
    })()

    return () => {
      alive = false
      styleRef.current?.remove()
    }
  }, [bundleId])

  useEffect(() => {
    const q = searchQuery?.trim()
    setCards(!q ? data : fuse?.search(q, { limit: 20 })?.map(r => r.item) || [])
    // Skip next 2 range changes after cards update (typing causes re-render)
    skipRangeChange.current = 2
  }, [data, searchQuery, fuse])

  // Calculate card dimensions based on container width
  const [columnCount, cardWidth, cardHeight, rowCount, gap] = useMemo(() => {
    // Use fallback width if container not ready yet
    log.debug('container-width', cw)
    const gap = 16
    const w = Math.min(180, (cw - gap * 3) / 2)
    const h = Math.floor(w * 4.5 / 3)
    const m = Math.floor((cw - gap) / (w + gap))
    const n = Math.ceil((cards?.length || 0) / m)

    return [m, w, h, n, Math.floor((cw - m * w) / (m + 1))]
  }, [cw, cards])

  const CellComponent = useCallback(({ columnIndex:j, rowIndex:i, style }) => {
    // log.debug('requesting', i, j)
    const x = i * columnCount + j
    const card = cards[x >> (side === 'both')]
    if (!card) return null
    const _side = side === 'both' ? (x & 1 ? 'front' : 'back') : side

    return (
      <Box
        style={style}
        sx={{
          ml: !j ? `${gap}px` : 0,
          mr: `${gap}px`,
          mt: 0
        }}
      >
        <CardPreview
          renderer={renderer}
          card={card}
          side={_side}
          width={cardWidth}
          height={cardHeight}
        />
      </Box>
    )
  }, [cards, renderer, side, cardWidth, cardHeight, columnCount, gap])

  if (!renderer) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color='neutral'>Loading cards...</Typography>
      </Box>
    )
  }

  if (renderer === 'error') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color='neutral'>Failed to load cards</Typography>
        <Button size='sm' variant='outlined' onClick={() => navigate(-1)} sx={{ mt: 1 }}>
          Go back
        </Button>
      </Box>
    )
  }

  return (
    <>
      <BrowserTools
        ref={toolsRef}
        prefs={prefs}
        session={session}
      />

      <Box
        onClick={handleEmptyClick}
        sx={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100vh', pt: 0 }}>
        <Box
          className={'uuuu'}
          sx={{
            px: 1,
            py: 0.5,
            height: 40,
            bgcolor: 'background.body',
            justifyContent: 'space-between',
            display: 'flex'
          }}
        >
          <Typography
            level="body-xs"
            color="neutral"
            sx={{
              opacity: 0.7,
              maxWidth: '110px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          > {shard?.name || 'Anki Shard'}
          </Typography>
          <Typography level='body-xs' color='neutral' sx={{ opacity: 0.7 }}>
            {searchQuery?.trim()
              ? `${cards?.length || 0} of ${data.length} cards`
              : `${data.length} cards`}
          </Typography>
        </Box>

        <Box
          className={'yyyy'}
          sx={{ height: 'calc(100vh - 40px)' }}
        >
          {!cards?.length ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color='neutral'>No cards found</Typography>
            </Box>
          ) : (
            <Grid
              columnCount={columnCount}
              columnWidth={j => {
                return cardWidth + gap + gap * !j
              }}
              rowCount={rowCount}
              rowHeight={cardHeight + 12}
              cellComponent={CellComponent}
              onCellsRendered={handleRangeChange}
              cellProps={{}}
              onResize={({ width }) => setGridWidth(width)}
            />
          )}
        </Box>
      </Box>
    </>
  )
}
