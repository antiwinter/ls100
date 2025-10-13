import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/joy'
import { FixedSizeList as List } from 'react-window'
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
  const listRef = useRef(null)
  const styleRef = useRef(null)

  const { bundleId, searchQuery, shard } = session()
  const { previewSide: side } = prefs()

  const fuse = useMemo(() => {
    if (!data.length) return null
    return new Fuse(data, {
      includeScore: true,
      threshold: 0.8,
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
    setCards(!q ? data : fuse?.search(q)?.map(r => r.item) || [])
  }, [data, searchQuery, fuse])

  if (!renderer) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color='neutral'>Loading data...</Typography>
      </Box>
    )
  }

  if (renderer === 'error') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color='neutral'>Failed to load data</Typography>
        <Button size='sm' variant='outlined' onClick={() => navigate(-1)} sx={{ mt: 1 }}>
          Go back
        </Button>
      </Box>
    )
  }

  const cardSize = 300
  const headerHeight = 72
  const rowHeight = cardSize + 16
  const listHeight = (window?.innerHeight || 800) - headerHeight
  const rowCount = Math.ceil((cards?.length || 0) / (side === 'both' ? 1 : 2))

  const renderRow = ({ index: i, style }) => {
    const data = side === 'both'
      ? [cards[i], cards[i]]
      : [cards[i * 2], cards[i * 2 + 1]]
    const sides = side === 'both' ? ['front', 'back'] : [side, side]

    return (
      <Box style={style} sx={{ px: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
        {data.map((card, i) => card && (
          <CardPreview
            key={card.id}
            renderer={renderer}
            card={card}
            side={sides[i]}
            height={cardSize}
          />
        ))}
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <BrowserTools
        prefs={prefs}
        session={session}
      />

      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        bgcolor: 'background.body',
        p: 2,
        height: headerHeight,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Typography level='title-lg' sx={{ mb: 0.5 }}>
          {shard?.name || 'Anki Shard'}
        </Typography>
        <Typography level='body-sm' color='neutral'>
          {searchQuery?.trim()
            ? `Showing ${cards?.length || 0} of ${data.length} cards`
            : `${data.length} cards`}
        </Typography>
      </Box>

      <Box sx={{ pt: `${headerHeight}px` }}>
        {!cards?.length ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color='neutral'>No data found</Typography>
          </Box>
        ) : (
          <List
            ref={listRef}
            height={listHeight}
            itemCount={rowCount}
            itemSize={rowHeight}
            width='100%'
          >
            {renderRow}
          </List>
        )}
      </Box>
    </Box>
  )
}
