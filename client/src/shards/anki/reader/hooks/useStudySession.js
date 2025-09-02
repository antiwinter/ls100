import { useState, useEffect, useCallback } from 'react'
import { StudyEngine, RATINGS } from '../../engine/studyEngine.js'
import { log } from '../../../../utils/logger'

// Custom hook for managing study sessions
export const useStudySession = (deck, options = {}) => {
  const [studyEngine, setStudyEngine] = useState(null)
  const [currentCard, setCurrentCard] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [progress, setProgress] = useState(null)
  const [isComplete, setIsComplete] = useState(false)
  const [sessionData, setSessionData] = useState(null)

  // Initialize study session
  const startSession = useCallback(async () => {
    if (!deck?.cards?.length) {
      log.warn('Cannot start session: no cards available')
      return false
    }

    const engine = new StudyEngine(deck.id)
    const session = await engine.initSession(deck.cards, options)

    if (!session) {
      log.warn('Failed to initialize study session')
      return false
    }

    setStudyEngine(engine)
    setIsComplete(false)
    setSessionData(null)
    loadNextCard(engine)

    log.info('Study session started:', session.id)
    return true
  }, [deck, options, loadNextCard])

  // Load next card
  const loadNextCard = useCallback((engine = studyEngine) => {
    if (!engine) return

    const nextCard = engine.getNextCard()

    if (!nextCard) {
      // Session complete
      const completedSession = engine.endSession()
      setCurrentCard(null)
      setProgress(null)
      setIsComplete(true)
      setSessionData(completedSession)
      log.info('Study session completed')
      return
    }

    setCurrentCard(nextCard)
    setShowAnswer(false)
    setProgress(engine.getProgress())
  }, [studyEngine])

  // Show answer
  const revealAnswer = useCallback(() => {
    setShowAnswer(true)
  }, [])

  // Rate current card
  const rateCard = useCallback(async (rating) => {
    if (!studyEngine || !currentCard) return false

    try {
      await studyEngine.rateCard(rating)

      // Small delay for better UX before loading next card
      setTimeout(() => {
        loadNextCard()
      }, 200)

      return true
    } catch (error) {
      log.error('Failed to rate card:', error)
      return false
    }
  }, [studyEngine, currentCard, loadNextCard])

  // End session
  const endSession = useCallback(() => {
    if (studyEngine) {
      const finalSessionData = studyEngine.endSession()
      setSessionData(finalSessionData)
      log.info('Study session ended by user')
    }

    setStudyEngine(null)
    setCurrentCard(null)
    setProgress(null)
    setShowAnswer(false)
    setIsComplete(false)
  }, [studyEngine])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!studyEngine || isComplete) return

      // Space/Enter to show answer
      if (!showAnswer && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        revealAnswer()
        return
      }

      // Number keys 1-4 for rating (only when answer is shown)
      if (showAnswer) {
        const ratingMap = {
          '1': RATINGS.AGAIN,
          '2': RATINGS.HARD,
          '3': RATINGS.GOOD,
          '4': RATINGS.EASY
        }

        if (ratingMap[e.key]) {
          e.preventDefault()
          rateCard(ratingMap[e.key])
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [studyEngine, showAnswer, isComplete, revealAnswer, rateCard])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (studyEngine) {
        studyEngine.endSession()
      }
    }
  }, [studyEngine])

  return {
    // State
    studyEngine,
    currentCard,
    showAnswer,
    progress,
    isComplete,
    sessionData,
    isActive: !!studyEngine && !isComplete,

    // Actions
    startSession,
    endSession,
    revealAnswer,
    rateCard,

    // Ratings enum for convenience
    RATINGS
  }
}
