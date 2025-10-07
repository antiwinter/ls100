import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/joy'
import { FixedSizeList as List } from 'react-window'
import anki from '../core/index.js'
import { Toolbar } from './overlay/Toolbar.jsx'
import { log } from '../../../utils/logger'
import { CardPreview } from './components/CardPreview.jsx'

export const AnkiViewer = ({ prefs, session, shardName, onExit, onStudy }) => {
  const [cards, setCards] = useState([])
  const [renderer, setRenderer] = useState(null)
  const [css, setCss] = useState('')

  const bundleId = session(state => state.bundleId)
  const previewSide = prefs(state => state.previewSide || 'back')

  // Load cards and build renderer based on bundleId
  useEffect(() => {
    if (!bundleId) {
      setCards([])
      setRenderer('error')
      setCss('')
      return
    }

    let alive = true
    ;(async () => {
      try {
        const allCards = await anki.getCardsForBundles([bundleId])
        if (!allCards?.length) {
          if (alive) { setCards([]); setRenderer('error'); setCss('') }
          return
        }

        const rctx = await anki.createRender(allCards)
        if (!rctx) {
          if (alive) { setCards([]); setRenderer('error'); setCss('') }
          return
        }

        if (alive) {
          setCards(allCards)
          setRenderer(rctx)
          setCss(rctx.css || '')
        }
      } catch (err) {
        log.error('Failed to load cards:', err)
        if (alive) { setCards([]); setRenderer('error'); setCss('') }
      }
    })()

    return () => { alive = false }
  }, [bundleId])

  if (!renderer) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Loading cards...</Typography>
      </Box>
    )
  }

  if (renderer === 'error') {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Failed to load cards</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toolbar shardId={bundleId} onBack={onExit} onStudy={onStudy} />

      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography level="title-lg" sx={{ mb: 0.5 }}>
          {shardName || 'Anki Shard'}
        </Typography>
        <Typography level="body-sm" color="neutral">
          {cards.length} cards
        </Typography>
      </Box>

      {css && <style>{css}</style>}

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
