import { useRef, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Alert
} from '@mui/joy'

import { Rating } from 'ts-fsrs'
import anki from '../core/index.js'
import { log } from '../../../utils/logger'
import { AnkiCard, RatingButtons, SessionSummary } from './components'
import { Toolbar } from './overlay/Toolbar.jsx'

export const StudyMode = ({ bundleIds: _bundleIds, studyEngine, onEndStudy, shardId }) => {
  // Minimal local UI state per coding rules
  const renderer = useRef(null)
  const ak = useRef(null)
  const currentCard = useRef(null)

  // Define functions before useEffects that use them
  const loadCard = useCallback(async () => {
    if (!studyEngine) return
    // Elegant resume: prefer the session's currentCard; otherwise draw
    let result = studyEngine.draw()
    log.debug('drawed', result)
    if (!result) {
      // session complete UI handled below when piles are empty and no currentCard
      log.info('Study session completed naturally')
      return
    }

    ak.lockNload(await renderer.render(result))
    currentCard.current = result
  }, [studyEngine])

  const handleRate = useCallback(async (rating) => {
    let r = ({ 'left': Rating.Again, 'right': Rating.Good })[rating]
    await studyEngine.rate(r || rating)
    loadCard()
  }, [studyEngine, loadCard])

  const handleFlip = useCallback((side) => {
    log.debug('Card flipped:', side)
    // setShowAnswer(side === 'back')
  }, [])

  // On mount/resume: show current or draw
  useEffect(() => { loadCard() }, [studyEngine, loadCard])
  useEffect(() => {
    const { raw, review } = studyEngine.session.pile
    renderer.current = anki.createRender(
      [...raw, ...review,
        studyEngine.session.currentCard])
  }, [studyEngine])

  // Clean up auto-end timeout on manual exit
  const handleManualExit = () => {
    onEndStudy()
  }

  if (studyEngine.session?.isFinished()) {
    // Build session data from current session state
    return (
      <SessionSummary />
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        shardId={shardId}
        onBack={handleManualExit}
      />

      <AnkiCard
        ref={ak}
        card={currentCard.current}
        onFlip={handleFlip}
        onExit={handleRate}
      />
    </Box>
  )
}
