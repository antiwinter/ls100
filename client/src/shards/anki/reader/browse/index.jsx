import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, Button } from '@mui/joy'
import { FixedSizeList as List } from 'react-window'
import anki from '../core/index.js'
import db from '../core/db.js'
import { ViewerOverlay } from './overlay/ViewerOverlay.jsx'
import { log } from '../../../utils/logger'
import { CardPreview } from './components/CardPreview.jsx'

const CARD_HEIGHT = 300
const ROW_GAP = 16
const TOOLBAR_HEIGHT = 72
const HEADER_HEIGHT = 92

export const AnkiViewer = ({ prefs, session, shardName, onExit, onStudy }) => {
  const [cards, setCards] = useState([])
  const [displayCards, setDisplayCards] = useState([])
  const [noteMap, setNoteMap] = useState(new Map())
  const [renderer, setRenderer] = useState(null)
  const [css, setCss] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const listRef = useRef(null)

  const bundleId = session(state => state.bundleId)
  const previewSide = prefs(state => state.previewSide || 'back')

  useEffect(() => {
    if (!bundleId) {
      setCards([])
      setDisplayCards([])
      setNoteMap(new Map())
      setRenderer('error')
      setCss('')
      return
    }

    let alive = true
    ;(async () => {
      try {
        const allCards = await anki.getCardsForBundles([bundleId])
        if (!allCards?.length) {
          if (alive) {
            setCards([])
            setDisplayCards([])
            setNoteMap(new Map())
            setRenderer('error')
            setCss('')
          }
          return
        }

        const rctx = await anki.createRender(allCards)
        if (!rctx) {
          if (alive) {
            setCards([])
            setDisplayCards([])
            setNoteMap(new Map())
            setRenderer('error')
            setCss('')
          }
          return
        }

        const noteIds = Array.from(new Set(allCards.map(card => card.noteId)))
        const notes = noteIds.length ? await db.notes.bulkGet(noteIds) : []
        const map = new Map()
        noteIds.forEach((id, index) => {
          const note = notes[index]
          if (note) map.set(id, note)
        })

        if (alive) {
          setCards(allCards)
          setDisplayCards(allCards)
          setNoteMap(map)
          setRenderer(rctx)
          setCss(rctx.css || '')
        }
      } catch (err) {
        log.error('Failed to load cards:', err)
        if (alive) {
          setCards([])
          setDisplayCards([])
          setNoteMap(new Map())
          setRenderer('error')
          setCss('')
        }
      }
    })()

    return () => { alive = false }
  }, [bundleId])

  const handleSearchChange = useCallback((query, filtered) => {
    setSearchQuery(query)
    if (!query?.trim()) {
      setDisplayCards(cards)
      return
    }
    setDisplayCards(filtered || [])
  }, [cards])

  const handleLocateCard = useCallback((card) => {
    if (!card) return
    const index = displayCards.findIndex(c => c.id === card.id)
    if (index < 0) return
    const list = listRef.current
    if (!list) return
    const isBoth = previewSide === 'both'
    const rowIndex = isBoth ? index : Math.floor(index / 2)
    if (typeof list.scrollToItem === 'function') {
      list.scrollToItem(rowIndex, 'start')
    } else if (typeof list.scrollTo === 'function') {
      list.scrollTo(rowIndex * (CARD_HEIGHT + ROW_GAP))
    }
  }, [displayCards, previewSide])

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
        <Button size='sm' variant='outlined' onClick={onExit} sx={{ mt: 1 }}>
          Go back
        </Button>
      </Box>
    )
  }

  const totalCards = cards.length
  const visibleCards = displayCards.length
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const listHeight = Math.max(400, viewportHeight - (TOOLBAR_HEIGHT + HEADER_HEIGHT))
  const ROW_HEIGHT = CARD_HEIGHT + ROW_GAP
  const isBoth = previewSide === 'both'
  const rowCount = isBoth ? visibleCards : Math.ceil(visibleCards / 2)

  const renderRow = ({ index, style }) => {
    let leftCard, rightCard, leftSide, rightSide
    if (isBoth) {
      const card = displayCards[index]
      leftCard = rightCard = card
      leftSide = 'front'
      rightSide = 'back'
    } else {
      const leftIdx = index * 2
      const rightIdx = leftIdx + 1
      leftCard = displayCards[leftIdx]
      rightCard = displayCards[rightIdx]
      leftSide = rightSide = previewSide
    }

    return (
      <Box style={style} sx={{ px: 2, boxSizing: 'border-box' }}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {leftCard && (
            <CardPreview
              renderer={renderer}
              card={leftCard}
              side={leftSide}
              height={CARD_HEIGHT}
            />
          )}
          {rightCard && (
            <CardPreview
              renderer={renderer}
              card={rightCard}
              side={rightSide}
              height={CARD_HEIGHT}
            />
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <ViewerOverlay
        title={shardName || 'Anki shard'}
        cards={cards}
        notes={noteMap}
        prefs={prefs}
        onBack={onExit}
        onStudy={onStudy}
        onSearchChange={handleSearchChange}
        onLocateCard={handleLocateCard}
      />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: `${TOOLBAR_HEIGHT}px` }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Typography level='title-lg' sx={{ mb: 0.5 }}>
            {shardName || 'Anki Shard'}
          </Typography>
          <Typography level='body-sm' color='neutral'>
            {searchQuery?.trim()
              ? `Showing ${visibleCards} of ${totalCards} cards`
              : `${totalCards} cards`}
          </Typography>
        </Box>

        {css && <style>{css}</style>}

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {totalCards === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color='neutral'>No cards found</Typography>
            </Box>
          ) : visibleCards === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color='neutral'>No cards match the current search</Typography>
            </Box>
          ) : (
            <List
              ref={listRef}
              height={listHeight}
              itemCount={rowCount}
              itemSize={ROW_HEIGHT}
              width='100%'
            >
              {renderRow}
            </List>
          )}
        </Box>
      </Box>
    </Box>
  )
}
