import { useRef, useEffect, useCallback, useState } from 'react'
import { Box } from '@mui/joy'

import { Rating } from 'ts-fsrs'
import anki from '../core/index.js'
import { log } from '../../../utils/logger.js'
import { AnkiCard, SessionSummary, RatingButtons } from './components/index.js'
import { Toolbar } from './overlay/Toolbar.jsx'

export const AnkiStudy = ({ shardId, onExit }) => {
  // Self-contained study engine and refs
  const ak = useRef(null)
  const _ctx = useRef({})
  const ctx = _ctx.current
  const [hint, setHint] = useState(null)
  const [card, setCard] = useState(null)

  log.debug('AnkiStudy-render', { shardId, onExit, card })
  // Clean card loading
  const loadCard = useCallback(async (exit = 1) => {
    if (!ctx.engine) return

    const card = ctx.engine.draw()
    if (!card) {
      log.info('Study session completed')
      return
    }

    const rendered = await ctx.renderer.render(card)
    log.debug('LnL card', card)
    ak.current?.locknLoad(exit, rendered)
    setCard(card)

    log.debug('Card loaded:', card.id)
  }, [ctx])

  const handleRate = useCallback(async (rating) => {
    await ctx.engine.rate(rating)
    loadCard(rating === Rating.Again ? -1 : 1)
  }, [loadCard, ctx])

  const handleCardExit = useCallback(async (ox) => {
    await ctx.engine.rate(ox < 0 ? Rating.Again : Rating.Good)
    setHint(null)
    loadCard(0)
  }, [ctx, loadCard])

  const handleFlip = useCallback((side) => {
    log.debug('Card flipped:', side)
  }, [])

  const handleMove = useCallback((ox) => {
    setHint(!ox ? null : ox < 0 ? Rating.Again : Rating.Good)
  }, [])

  // Initialize study engine and renderer
  useEffect(() => {
    const init = async () => {
      if (!shardId) return

      // Create session store and study engine
      const prefs = anki.AnkiPrefsStore().getState()
      const { AnkiSessionStore } = await import('../core/sessionStore.js')
      const store = AnkiSessionStore(shardId)
      const engine = await anki.createEngine(prefs, store)

      ctx.engine = engine

      // Create renderer for all cards
      ctx.renderer = await anki.createRender(engine.cards())

      // Load first card
      loadCard()
    }

    init()

    // Cleanup: stop time tracker when unmounting
    return () => {
      ctx.engine?.exit()
    }
  }, [shardId, loadCard, ctx])

  // Session complete check
  const engine = ctx.engine
  if (engine?.isFinished()) {
    return <SessionSummary onExit={onExit} />
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        shardId={shardId}
        onBack={onExit}
      />

      <AnkiCard
        ref={ak}
        onFlip={handleFlip}
        onExit={handleCardExit}
        onMove={handleMove}
      />
      <RatingButtons
        onRate={handleRate}
        fsrs={card?.fsrs?.[0]}
        hint={hint}
        side={1}
      />
    </Box>
  )
}
