import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Alert, Button } from '@mui/joy'
import { FixedSizeList as List } from 'react-window'
import anki from '../core/index.js'
import { AnkiSessionStore } from '../core/sessionStore.js'
import { Toolbar } from './overlay/Toolbar.jsx'
import { AnkiStudy } from './AnkiStudy.jsx'
import { shardApi } from '../../shardApi.js'
import { engineCleanup } from '../../engines.js'
import { log } from '../../../utils/logger'

// On-demand preview for a single card
const CardPreview = ({ renderer, card, side = 'back' }) => {
  const [rendered, setRendered] = useState(null)
  const reqIdRef = useRef(0)

  // log.debug('CardPreview re-render', { renderer, card, side })
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
  const [studyMode, setStudyMode] = useState(false)

  // Session store: react to previewSide
  const store = AnkiSessionStore(shardId)
  // fixme: previewSide should be in prefs
  const previewSide = store(state => state.previewSide || 'back')

  // Fetch shard once per shardId
  useEffect(() => {
    let alive = true
    shardApi.read(shardId)
      .then((shard) => { if (alive) setShard(shard || 'error') })
      .catch((err) => { log.error('Failed to load shard:', err); if (alive) setShard('error') })
    return () => { alive = false }
  }, [shardId])

  // no-op: shard loading handled by previous effect

  // Load cards for first bundle and build renderer
  useEffect(() => {
    const firstBundleId = shard?.meta?.bundles?.[0]?.id
    if (!firstBundleId) {
      setCards([])
      setCss('')
      setRenderer('error')
      return
    }

    // Save bundleIds to session
    const bundleIds = shard.meta.bundles.map(b => b.id)
    store.setState({ bundleIds })

    let alive = true
    ;(async () => {
      try {
        const allCards = await anki.getCardsForBundles([firstBundleId])
        if (!allCards?.length) {
          if (alive) { setCards([]); setCss(''); setRenderer('error') }
          return
        }

        const rctx = await anki.createRender(allCards)
        if (!rctx) {
          if (alive) { setCards([]); setCss(''); setRenderer('error') }
          return
        }

        if (alive) { setRenderer(rctx); setCss(rctx.css || ''); setCards(allCards) }
      } catch (err) {
        log.error('Failed to load cards:', err)
        if (alive) { setCards([]); setCss(''); setRenderer('error') }
      }
    })()

    return () => { alive = false }
  }, [shard, store])

  // Toolbar actions
  const handleToolSelect = async (tool) => {
    switch (tool) {
    case 'study':
      log.debug('Navigate to study mode')
      setStudyMode(true)
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

  // Remove shard handler for error state
  const handleRemoveShard = async () => {
    if (!shard || shard === 'error') return

    try {
      log.info('Removing corrupted shard:', shardId)

      // Cleanup engine-specific data (bundles, cards, etc)
      await engineCleanup(shard, [])

      // Delete shard from local store
      await shardApi.delete(shardId)

      log.info('Shard removed successfully:', shardId)

      // Navigate back to home
      onBack()
    } catch (error) {
      log.error('Failed to remove shard:', error)
    }
  }

  if (shard === undefined) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Loading shard...</Typography>
      </Box>
    )
  }

  if (shard === 'error' || renderer === 'error') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-sm">Failed to load shard</Typography>
          <Button size="sm" color="danger" onClick={handleRemoveShard} sx={{ mt: 1, mr: 1 }}>
            Remove shard
          </Button>
          <Button size="sm" variant="outlined" onClick={onBack} sx={{ mt: 1 }}>
            Go back
          </Button>
        </Alert>
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

  // Render study mode or preview
  if (studyMode) {
    return <AnkiStudy shardId={shardId} onExit={() => setStudyMode(false)} />
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
