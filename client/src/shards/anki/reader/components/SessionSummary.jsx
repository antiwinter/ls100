import {
  Box,
  Typography,
  Button,
  Stack,
  Card,
  CardContent
} from '@mui/joy'
import { Refresh } from '@mui/icons-material'

export const SessionSummary = ({ sessionData, onRestart, onExit }) => {
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
