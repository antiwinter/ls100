import { useRef, useEffect, useCallback, useState } from 'react'
import { Box } from '@mui/joy'
import { Rating } from 'ts-fsrs'
import anki from '../core/index.js'
import { log } from '../../../utils/logger.js'
import { AnkiCard, SessionSummary, RatingButtons } from './components/index.js'
import { StudyOverlay } from './study/StudyOverlay.jsx'

export const AnkiStudy = ({ prefs, session, onExit }) => {
  const ak = useRef(null)
  const _ctx = useRef({})
  const ctx = _ctx.current
  const [glow, setGlow] = useState(null)
  const [card, setCard] = useState(null)

  const bundleId = session(state => state.bundleId)

  log.debug('AnkiStudy-render', { bundleId, onExit, cardId: card?.id })

  const loadCard = useCallback(async (exit = 1) => {
    if (!ctx.engine || !ctx.renderer) return
    const nextCard = ctx.engine.draw()
    if (!nextCard) {
      log.info('Study session completed')
      return
    }

    const rendered = await ctx.renderer.render(nextCard)
    ak.current?.locknLoad(exit, rendered)
    setCard(nextCard)
    log.debug('Card loaded:', nextCard.id)
  }, [ctx])

  const refreshCard = useCallback(async () => {
    if (!ctx.renderer || !card) return
    const rendered = await ctx.renderer.render(card)
    ak.current?.locknLoad(0, rendered)
  }, [ctx, card])

  const handleRate = useCallback(async (rating) => {
    if (!ctx.engine || !card) return
    await ctx.engine.rate(card, rating)
    loadCard(rating === Rating.Again ? -1 : 1)
  }, [loadCard, ctx, card])

  const handleUndo = useCallback(async () => {
    if (!ctx.engine || !ctx.renderer) return
    const undone = await ctx.engine.undo()
    if (!undone) return
    const rendered = await ctx.renderer.render(undone)
    ak.current?.locknLoad(0, rendered)
    setCard(undone)
    setGlow(null)
  }, [ctx])

  const handleCardExit = useCallback(async (ox) => {
    if (!ctx.engine || !card) return
    await ctx.engine.rate(ox < 0 ? Rating.Again : Rating.Good)
    setGlow(null)
    loadCard(0)
  }, [ctx, loadCard, card])

  const handleFlip = useCallback((side) => {
    log.debug('Card flipped:', side)
  }, [])

  const handleMove = useCallback((ox) => {
    setGlow(!ox ? null : ox < 0 ? Rating.Again : Rating.Good)
  }, [])

  const rebuildRenderer = useCallback(async () => {
    if (!ctx.engine) return
    const cardsForRender = ctx.engine.cards()
    ctx.renderer = cardsForRender.length ? await anki.createRender(cardsForRender) : null
  }, [ctx])

  const handleResetSession = useCallback(async () => {
    if (!ctx.engine) return
    await ctx.engine.reset(false)
    await rebuildRenderer()
    setGlow(null)
    setCard(null)
    await loadCard()
  }, [ctx, loadCard, rebuildRenderer])

  const handleRebuildSession = useCallback(async () => {
    if (!ctx.engine) return
    await ctx.engine.reset(true)
    await rebuildRenderer()
    setGlow(null)
    setCard(null)
    await loadCard()
  }, [ctx, loadCard, rebuildRenderer])

  const handleBury = useCallback(async () => {
    if (!ctx.engine || !card) return
    await ctx.engine.bury(card)
    setGlow(null)
    await loadCard(0)
  }, [ctx, card, loadCard])

  const handleSuspend = useCallback(async () => {
    if (!ctx.engine || !card) return
    await ctx.engine.suspend(card)
    setGlow(null)
    await loadCard(0)
  }, [ctx, card, loadCard])

  const handleAction = useCallback(async (action) => {
    switch (action) {
    case 'undo':
      await handleUndo()
      break
    case 'bury':
      await handleBury()
      break
    case 'suspend':
      await handleSuspend()
      break
    case 'reset-session':
      await handleResetSession()
      break
    case 'rebuild-session':
      await handleRebuildSession()
      break
    case 'card-saved':
      await refreshCard()
      break
    default:
      log.warn('Unknown action:', action)
    }
  }, [handleUndo, handleBury, handleSuspend, handleResetSession, handleRebuildSession, refreshCard])

  useEffect(() => {
    const init = async () => {
      if (!bundleId) return

      ctx.engine?.exit()
      ctx.engine = null
      ctx.renderer = null

      const prefsState = prefs.getState()
      const engine = await anki.createEngine(prefsState, session)
      ctx.engine = engine

      const renderer = await anki.createRender(engine.cards())
      ctx.renderer = renderer

      await loadCard()
    }

    init()

    return () => {
      ctx.engine?.exit()
    }
  }, [bundleId, prefs, session, loadCard, ctx])

  const engine = ctx.engine
  if (engine?.status()?.done) {
    return <SessionSummary onExit={onExit} />
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <StudyOverlay
        onAction={handleAction}
        card={card}
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
        glow={glow}
        side={1}
      />
    </Box>
  )
}
