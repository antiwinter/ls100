import { useRef, useEffect, useCallback, useState } from 'react'
import { Box } from '@mui/joy'
import { Rating } from 'ts-fsrs'
import anki from '../core/index.js'
import db from '../core/db.js'
import { log } from '../../../utils/logger.js'
import { AnkiCard, SessionSummary, RatingButtons } from './components/index.js'
import { StudyOverlay } from './overlay/StudyOverlay.jsx'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

export const AnkiStudy = ({ prefs, session, onExit }) => {
  const ak = useRef(null)
  const _ctx = useRef({})
  const ctx = _ctx.current
  const [glow, setGlow] = useState(null)
  const [card, setCard] = useState(null)
  const [engineKey, setEngineKey] = useState(0)

  const bundleId = session(state => state.bundleId)
  const actions = session(state => state.actions)
  const queueSnapshot = session(state => state.queue)
  const ttd = session(state => state.ttd)

  log.debug('AnkiStudy-render', { bundleId, onExit, cardId: card?.id, engineKey })

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

  const handleResetSession = useCallback(async () => {
    if (!ctx.engine) return
    try {
      while (ctx.engine.actions?.length) {
        await ctx.engine.undo()
      }
    } catch (err) {
      log.error('Reset undo loop failed', err)
    }
    ctx.engine.exit()
    session.setState({ day: null, queue: null, actions: [], ttd: null })
    setGlow(null)
    setCard(null)
    setEngineKey(key => key + 1)
  }, [ctx, session])

  const handleRebuildSession = useCallback(async () => {
    ctx.engine?.exit()
    session.setState(state => ({ ...state, queue: null }))
    setGlow(null)
    setCard(null)
    setEngineKey(key => key + 1)
  }, [ctx, session])

  const handleBury = useCallback(async () => {
    if (!ctx.engine || !card) return
    const idx = ctx.engine.queue?.findIndex(c => c?.id === card.id)
    if (idx !== undefined && idx >= 0) {
      ctx.engine.queue.splice(idx, 1)
      ctx.engine._flush?.(['queue'])
    }
    setGlow(null)
    await loadCard(0)
  }, [ctx, card, loadCard])

  const handleSuspend = useCallback(async () => {
    if (!ctx.engine || !card) return
    await db.cards.update(card.id, {
      state: 'Suspended',
      due: Date.now() + YEAR_MS,
      fsrs: card.fsrs
    })
    const idx = ctx.engine.queue?.findIndex(c => c?.id === card.id)
    if (idx !== undefined && idx >= 0) {
      ctx.engine.queue.splice(idx, 1)
      ctx.engine._flush?.(['queue'])
    }
    setGlow(null)
    await loadCard(0)
  }, [ctx, card, loadCard])

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
  }, [bundleId, prefs, session, loadCard, ctx, engineKey])

  const engine = ctx.engine
  if (engine?.status()?.done) {
    return <SessionSummary onExit={onExit} />
  }

  const canUndo = (actions?.length || 0) > 0

  const queueCards = ctx.engine?.queue?.filter(Boolean) || []
  const remainingFromQueue = queueSnapshot
    ? queueSnapshot.filter(id => id).length
    : queueCards.length
  const newCount = queueCards.filter(c => c?.state === 'New').length
  const reviewCount = queueCards.length - newCount

  const sessionStats = {
    studiedCount: actions?.length || 0,
    remainingCount: remainingFromQueue,
    newCount,
    reviewCount,
    totalCount: (actions?.length || 0) + remainingFromQueue,
    ttd
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <StudyOverlay
        title='Study'
        onBack={onExit}
        canUndo={canUndo}
        onUndo={handleUndo}
        onResetSession={handleResetSession}
        onRebuildSession={handleRebuildSession}
        sessionStats={sessionStats}
        card={card}
        onCardSaved={refreshCard}
        onBury={handleBury}
        onSuspend={handleSuspend}
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
