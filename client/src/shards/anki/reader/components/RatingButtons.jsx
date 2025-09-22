import { Box, Stack, Button, Typography } from '@mui/joy'
import { Rating } from 'ts-fsrs'
import { formatInterval } from '../../../../utils/dateFormat.js'

// FSRS Rating constants
const RATINGS = {
  AGAIN: Rating.Again,   // 1 - Forgot/wrong
  HARD: Rating.Hard,     // 2 - Correct but difficult
  GOOD: Rating.Good,     // 3 - Correct with effort
  EASY: Rating.Easy      // 4 - Correct and easy
}

export const RatingButtons = ({ onRate, intervals }) => {
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
