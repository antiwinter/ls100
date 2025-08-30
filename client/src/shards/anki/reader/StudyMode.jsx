import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Alert
} from '@mui/joy'
import { Close, Refresh } from '@mui/icons-material'

import { RATINGS, formatInterval, getRatingLabel } from '../engine/studyEngine.js'
import { log } from '../../../utils/logger'

const ProgressHeader = ({ progress, onExit }) => {
  if (!progress) return null

  const { cardsStudied, cardsRemaining, timeElapsed, accuracy } = progress
  const totalCards = cardsStudied + cardsRemaining
  const progressPercent = totalCards > 0 ? (cardsStudied / totalCards) * 100 : 0

  // Format time
  const minutes = Math.floor(timeElapsed / (1000 * 60))
  const seconds = Math.floor((timeElapsed % (1000 * 60)) / 1000)
  const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return (
    <Box sx={{ p: 2, bgcolor: 'background.level1', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography level="title-sm" sx={{ flex: 1 }}>
          Study Session
        </Typography>
        <Typography level="body-sm" color="neutral" sx={{ mr: 2 }}>
          {timeText}
        </Typography>
        <IconButton size="sm" onClick={onExit}>
          <Close />
        </IconButton>
      </Box>

      <LinearProgress
        determinate
        value={progressPercent}
        sx={{ mb: 1 }}
      />

      <Stack direction="row" justifyContent="space-between">
        <Typography level="body-xs" color="neutral">
          {cardsStudied}/{totalCards} cards • {Math.round(accuracy * 100)}% correct
        </Typography>
        <Typography level="body-xs" color="neutral">
          {cardsRemaining} remaining
        </Typography>
      </Stack>
    </Box>
  )
}

const CardDisplay = ({ card, showAnswer, onShowAnswer }) => {
  if (!card) return null

  // Use simplified card structure with direct question/answer
  const questionHtml = card.question || 'No question'
  const answerHtml = card.answer || 'No answer'

  return (
    <Card sx={{
      flex: 1,
      m: 3,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 300
    }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Card info */}
        <Typography level="body-sm" color="neutral" sx={{ mb: 2, textAlign: 'center' }}>
          Card {card.id}
        </Typography>

        {/* Question */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box
            sx={{
              fontSize: '1.1rem',
              textAlign: 'center',
              '& img': { maxWidth: '100%', height: 'auto' },
              '& .cloze-deletion': {
                bgcolor: 'warning.100',
                color: 'warning.800',
                px: 1.5,
                py: 0.75,
                borderRadius: 'sm',
                fontWeight: 'bold',
                fontSize: '1.1em'
              }
            }}
            dangerouslySetInnerHTML={{ __html: questionHtml }}
          />

          {showAnswer && (
            <>
              <Box sx={{ my: 3, textAlign: 'center' }}>
                <Box sx={{
                  height: 1,
                  bgcolor: 'divider',
                  position: 'relative',
                  '&::after': {
                    content: '"Answer"',
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: 'background.body',
                    px: 2,
                    fontSize: '0.8rem',
                    color: 'text.tertiary'
                  }
                }} />
              </Box>

              <Box
                sx={{
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  '& img': { maxWidth: '100%', height: 'auto' },
                  '& .cloze-answer': {
                    bgcolor: 'success.100',
                    color: 'success.800',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 'sm',
                    fontWeight: 'bold',
                    fontSize: '1.1em'
                  }
                }}
                dangerouslySetInnerHTML={{ __html: answerHtml }}
              />
            </>
          )}
        </Box>

        {/* Show answer button */}
        {!showAnswer && (
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button
              size="lg"
              onClick={onShowAnswer}
              sx={{ minWidth: 120 }}
            >
              Show Answer
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

const RatingButtons = ({ onRate, intervals }) => {
  const buttons = [
    { rating: RATINGS.AGAIN, label: 'Again', color: 'danger', shortcut: '1' },
    { rating: RATINGS.HARD, label: 'Hard', color: 'warning', shortcut: '2' },
    { rating: RATINGS.GOOD, label: 'Good', color: 'success', shortcut: '3' },
    { rating: RATINGS.EASY, label: 'Easy', color: 'primary', shortcut: '4' }
  ]

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2}>
        {buttons.map(({ rating, label, color, shortcut }) => (
          <Button
            key={rating}
            color={color}
            variant="solid"
            size="lg"
            sx={{ flex: 1, flexDirection: 'column', gap: 0.5, py: 2 }}
            onClick={() => onRate(rating)}
          >
            <Typography level="title-sm">{label}</Typography>
            <Typography level="body-xs" sx={{ opacity: 0.8 }}>
              {intervals?.[rating] ? formatInterval(intervals[rating]) : shortcut}
            </Typography>
          </Button>
        ))}
      </Stack>

      <Typography level="body-xs" color="neutral" sx={{ textAlign: 'center', mt: 1 }}>
        Use keys 1-4 or click buttons to rate your recall
      </Typography>
    </Box>
  )
}

const SessionComplete = ({ sessionData, onRestart, onExit }) => {
  if (!sessionData) return null

  const { cardsStudied, correctAnswers, timeSpent, ratings: _ratings } = sessionData
  const accuracy = cardsStudied > 0 ? Math.round((correctAnswers / cardsStudied) * 100) : 0
  const timeMinutes = Math.round(timeSpent / (1000 * 60))

  return (
    <Box sx={{ p: 4, textAlign: 'center', maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography level="h3" sx={{ mb: 2 }}>
        🎉 Session Complete!
      </Typography>

      <Stack spacing={2} sx={{ mb: 4 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography level="title-lg">{cardsStudied}</Typography>
            <Typography level="body-sm" color="neutral">Cards Studied</Typography>
          </CardContent>
        </Card>

        <Stack direction="row" spacing={2}>
          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent>
              <Typography level="title-md">{accuracy}%</Typography>
              <Typography level="body-sm" color="neutral">Accuracy</Typography>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ flex: 1 }}>
            <CardContent>
              <Typography level="title-md">{timeMinutes}m</Typography>
              <Typography level="body-sm" color="neutral">Time</Typography>
            </CardContent>
          </Card>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2}>
        <Button variant="outlined" onClick={onRestart} startDecorator={<Refresh />}>
          Study More
        </Button>
        <Button onClick={onExit}>
          Back to Browse
        </Button>
      </Stack>
    </Box>
  )
}

export const StudyMode = ({ deck, studyEngine, onEndStudy }) => {
  const [currentCard, setCurrentCard] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [progress, setProgress] = useState(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [intervals, setIntervals] = useState(null)
  const [error, setError] = useState(null)

  // Define functions before useEffects that use them
  const loadNextCard = useCallback(() => {
    if (!studyEngine) return

    try {
      const nextCard = studyEngine.getNextCard()

      if (!nextCard) {
        // Session complete
        const sessionData = studyEngine.endSession()
        setSessionComplete(true)
        setProgress(null)
        log.info('Study session completed:', sessionData)
        return
      }

      setCurrentCard(nextCard)
      setShowAnswer(false)
      setProgress(studyEngine.getProgress())
      setError(null)

      // Calculate intervals for rating preview (if we have FSRS data)
      if (nextCard.fsrsCard) {
        try {
          // This would need the FSRS instance to calculate intervals
          // For now, we'll just show the shortcuts
          setIntervals(null)
        } catch (err) {
          log.warn('Failed to calculate intervals:', err)
          setIntervals(null)
        }
      }

    } catch (err) {
      log.error('Failed to load next card:', err)
      setError('Failed to load next card')
    }
  }, [studyEngine])

  const handleRate = useCallback(async (rating) => {
    if (!studyEngine || !currentCard) return

    try {
      await studyEngine.rateCard(rating)
      log.debug('Card rated:', { cardId: currentCard.id, rating: getRatingLabel(rating) })

      // Load next card
      setTimeout(() => {
        loadNextCard()
      }, 300) // Small delay for better UX

    } catch (err) {
      log.error('Failed to rate card:', err)
      setError('Failed to rate card')
    }
  }, [studyEngine, currentCard, loadNextCard])

  const handleShowAnswer = () => {
    setShowAnswer(true)
  }

  // Load next card on mount and after rating
  useEffect(() => {
    loadNextCard()
  }, [studyEngine, loadNextCard])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!showAnswer) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          setShowAnswer(true)
        }
      } else {
        const ratings = { '1': RATINGS.AGAIN, '2': RATINGS.HARD, '3': RATINGS.GOOD, '4': RATINGS.EASY }
        if (ratings[e.key]) {
          e.preventDefault()
          handleRate(ratings[e.key])
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [showAnswer, handleRate])

  const handleRestart = () => {
    setSessionComplete(false)
    setCurrentCard(null)
    setShowAnswer(false)
    setError(null)

    // Initialize new session
    if (deck && studyEngine) {
      const session = studyEngine.initSession(deck.cards)
      log.info('New study session started:', session.id)
      loadNextCard()
    }
  }

  if (!studyEngine || !deck) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert color="warning">
          No study session active
        </Alert>
      </Box>
    )
  }

  if (sessionComplete) {
    const sessionData = studyEngine.session
    return (
      <SessionComplete
        sessionData={sessionData}
        onRestart={handleRestart}
        onExit={onEndStudy}
      />
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={loadNextCard}>Try Again</Button>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ProgressHeader progress={progress} onExit={onEndStudy} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardDisplay
          card={currentCard}
          showAnswer={showAnswer}
          onShowAnswer={handleShowAnswer}
        />

        {showAnswer && (
          <RatingButtons
            onRate={handleRate}
            intervals={intervals}
          />
        )}
      </Box>
    </Box>
  )
}
