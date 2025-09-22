import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Alert, Button } from '@mui/joy'
import { FixedSizeList as List } from 'react-window'
import anki from '../core/index.js'
import { AnkiSessionStore } from '../core/sessionStore.js'
import { useSnapshot } from 'valtio'
import { Toolbar } from './overlay/Toolbar.jsx'
import { apiCall } from '../../../config/api.js'
import { log } from '../../../utils/logger'

// On-demand preview for a single card
const CardPreview = ({ renderer, card, side = 'front' }) => {
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

export const AnkiReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(undefined)
  const [cards, setCards] = useState([])
  const [css, setCss] = useState('')
  const [renderer, setRenderer] = useState(null)

  // Session store: react to previewSide
  const store = AnkiSessionStore(shardId)
  const snap = useSnapshot(store)
  const previewSide = snap.previewSide || 'front'

  // Fetch shard once per shardId
  useEffect(() => {
    let alive = true
    setShard(undefined)
    apiCall(`/api/shards/${shardId}`)
      .then((data) => { if (alive) setShard(data.shard || null) })
      .catch((err) => { log.error('Failed to load shard:', err); if (alive) setShard(null) })
    return () => { alive = false }
  }, [shardId])

  // no-op: shard loading handled by previous effect

  // Load cards for first bundle and build renderer
  useEffect(() => {
    const firstBundleId = shard?.metadata?.bundles?.[0]?.id
    if (!firstBundleId) {
      setCards([])
      setCss('')
      setRenderer(null)
      return
    }

    let alive = true
    ;(async () => {
      try {
        const allCards = await anki.getCardsForBundles([firstBundleId])
        if (!allCards?.length) {
          if (alive) { setCards([]); setCss(''); setRenderer(null) }
          return
        }

        const rctx = await anki.createRender(allCards)
        if (!rctx) {
          if (alive) { setCards([]); setCss(''); setRenderer(null) }
          return
        }

        if (alive) { setRenderer(rctx); setCss(rctx.css || ''); setCards(allCards) }
      } catch (err) {
        log.error('Failed to load cards:', err)
        if (alive) { setCards([]); setCss(''); setRenderer(null) }
      }
    })()

    return () => { alive = false }
  }, [shard])

  // Toolbar actions
  const handleToolSelect = async (tool) => {
    switch (tool) {
    case 'study':
      log.debug('Navigate to study mode')
      break
    case 'statistics':
    case 'settings':
    case 'search':
      log.debug('Toolbar action placeholder:', tool)
      break
    default:
      log.warn('Unknown tool action:', tool)
    }
  }

  if (shard === undefined) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Loading shard...</Typography>
      </Box>
    )
  }

  if (shard === null) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-sm">Failed to load shard</Typography>
          <Button size="sm" onClick={() => {
            setShard(undefined)
            apiCall(`/api/shards/${shardId}`)
              .then((data) => setShard(data.shard || null))
              .catch((err) => { log.error('Failed to load shard:', err); setShard(null) })
          }} sx={{ mt: 1 }}>
            Retry
          </Button>
        </Alert>
      </Box>
    )
  }

  const firstBundleId = shard?.metadata?.bundles?.[0]?.id
  if (!firstBundleId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral" sx={{ mb: 2 }}>
          No content available. Import some .apkg files to get started.
        </Typography>
      </Box>
    )
  }

  if (!renderer) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Loading cards...</Typography>
      </Box>
    )
  }

  // Render two-column card preview with react-window
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Toolbar shardId={shard.id} onBack={onBack} onToolSelect={handleToolSelect} />

      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography level="title-lg" sx={{ mb: 0.5 }}>
          {shard.name || 'Anki Shard'}
        </Typography>
        <Typography level="body-sm" color="neutral">
          {cards.length} cards
        </Typography>
      </Box>

      {/* Bundle CSS */}
      {css && <style>{css}</style>}

      {/* Cards virtual list: each row shows two cards */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {cards.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="neutral">No cards found</Typography>
          </Box>
        ) : (
          (() => {
            const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
            const TOOLBAR_HEIGHT = 70
            const HEADER_HEIGHT = 80
            const listHeight = Math.max(400, viewportHeight - (TOOLBAR_HEIGHT + HEADER_HEIGHT))
            const ROW_HEIGHT = 300
            const isBoth = previewSide === 'both'
            const rowCount = isBoth ? cards.length : Math.ceil(cards.length / 2)

            const Row = ({ index, style }) => {
              let leftCard, rightCard, leftSide, rightSide
              if (isBoth) {
                leftCard = rightCard = cards[index]
                leftSide = 'front'
                rightSide = 'back'
              } else {
                const leftIdx = index * 2
                const rightIdx = leftIdx + 1
                leftCard = cards[leftIdx]
                rightCard = cards[rightIdx]
                leftSide = rightSide = previewSide
              }

              return (
                <Box style={style} sx={{ px: 2, boxSizing: 'border-box' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>{leftCard && <CardPreview renderer={renderer} card={leftCard} side={leftSide} />}</Box>
                    <Box>{rightCard && <CardPreview renderer={renderer} card={rightCard} side={rightSide} />}</Box>
                  </Box>
                </Box>
              )
            }

            return (
              <List
                height={listHeight}
                itemCount={rowCount}
                itemSize={ROW_HEIGHT}
                width={'100%'}
              >
                {Row}
              </List>
            )
          })()
        )}
      </Box>
    </Box>
  )
}
