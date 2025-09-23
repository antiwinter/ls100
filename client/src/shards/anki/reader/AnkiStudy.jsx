import { useRef, useEffect, useCallback, useState } from 'react'
import { Box } from '@mui/joy'

import { Rating } from 'ts-fsrs'
import anki from '../core/index.js'
import { log } from '../../../utils/logger.js'
import { AnkiCard, SessionSummary, RatingButtons } from './components/index.js'
import { Toolbar } from './overlay/Toolbar.jsx'
import { AnkiSessionStore } from '../core/sessionStore.js'

export const AnkiStudy = ({ shardId, onExit }) => {
  // Self-contained study engine and refs
  const ak = useRef(null)
  const _ctx = useRef({})
  const ctx = _ctx.current
  const [hint, setHint] = useState(null)
  const [card, setCard] = useState(null)

  // Clean card loading
  const loadCard = useCallback(async () => {
    if (!ctx.engine) return

    const card = ctx.engine.draw()
    if (!card) {
      log.info('Study session completed')
      return
    }

    const rendered = await ctx.renderer.render(card)
    ak.current?.locknLoad(rendered)
    ctx.card = card
    setCard(card)
    setHint(null)

    log.debug('Card loaded:', card.id)
  }, [ctx])

  const handleRate = useCallback(async (rating) => {
    const r = ({ 'left': Rating.Again, 'right': Rating.Good })[rating]
    await ctx.engine.rate(r || rating)
    setHint(null)
    setCard(null)
    loadCard()
  }, [loadCard, ctx])

  const handleFlip = useCallback((side) => {
    log.debug('Card flipped:', side)
  }, [])

  const handleDrag = useCallback((ox) => {
    if (Math.abs(ox) < 50) setHint(null)
    else if (ox < 0) setHint(Rating.Again)
    else setHint(Rating.Good)
  }, [])

  // Initialize study engine and renderer
  useEffect(() => {
    const init = async () => {
      if (!shardId) return

      // Create session store and study engine
      const sessionStore = AnkiSessionStore(shardId)
      const engine = new anki.StudyEngine()
      await engine.init(sessionStore)

      ctx.engine = engine

      // Create renderer for all cards
      const { raw, review } = engine.session.pile
      ctx.renderer = await anki.createRender([
        ...raw,
        ...review,
        engine.session.currentCard
      ].filter(Boolean))

      // Load first card
      loadCard()
    }

    init()
  }, [shardId, loadCard, ctx])

  // Session complete check
  if (ctx.engine?.session?.isFinished()) {
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
        onExit={handleRate}
        onDrag={handleDrag}
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
