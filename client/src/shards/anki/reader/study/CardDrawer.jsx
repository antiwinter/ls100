import { useMemo } from 'react'
import {
  Stack,
  Typography,
  Button,
  Divider,
  Chip,
  LinearProgress
} from '@mui/joy'
import { fsrs as createFsrs } from 'ts-fsrs'

const fsrsModel = createFsrs({})

export const CardDrawer = ({ card, onAction, onClose }) => {
  const latest = card?.fsrs?.[0]
  const stability = latest?.stability || 0
  const difficulty = latest?.difficulty || 0
  const dueDate = latest?.due ? new Date(latest.due) : card?.due ? new Date(card.due) : null

  const forgetting = useMemo(() => {
    if (!stability) return []
    const intervals = [1, 3, 7, 14, 30]
    return intervals.map((day) => {
      const value = fsrsModel.forgetting_curve(day, stability)
      return {
        day,
        value: Math.max(0, Math.min(1, value))
      }
    })
  }, [stability])

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack spacing={0.25}>
        <Typography level='title-sm'>Current card</Typography>
        <Typography level='body-sm' color='neutral'>ID: {card?.id}</Typography>
        {dueDate && (
          <Typography level='body-sm' color='neutral'>
            Next review: {dueDate.toLocaleString()}
          </Typography>
        )}
      </Stack>

      <Divider />

      <Stack spacing={0.75}>
        <Typography level='title-sm'>FSRS status</Typography>
        <Stack direction='row' spacing={1}>
          <Chip size='sm' variant='soft'>Stability {stability?.toFixed(1) || '–'}</Chip>
          <Chip size='sm' variant='soft'>Difficulty {difficulty?.toFixed(1) || '–'}</Chip>
          <Chip size='sm' variant='outlined'>State {card?.state || 'Unknown'}</Chip>
        </Stack>
      </Stack>

      <Stack spacing={0.75}>
        <Typography level='title-sm'>Forgetting curve</Typography>
        {forgetting.length === 0 ? (
          <Typography level='body-sm' color='neutral'>Rate this card to unlock predictions.</Typography>
        ) : (
          <Stack spacing={0.5}>
            {forgetting.map(({ day, value }) => (
              <Stack key={day} spacing={0.25}>
                <Stack direction='row' justifyContent='space-between'>
                  <Typography level='body-sm'>Day {day}</Typography>
                  <Typography level='body-sm'>{Math.round(value * 100)}%</Typography>
                </Stack>
                <LinearProgress determinate value={value * 100} thickness={6} />
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography level='title-sm'>Operations</Typography>
        <Button variant='outlined' color='neutral' size='sm' onClick={async () => { await onAction?.('bury'); onClose?.() }}>
          Bury card
        </Button>
        <Button variant='solid' color='danger' size='sm' onClick={async () => { await onAction?.('suspend'); onClose?.() }}>
          Suspend card
        </Button>
      </Stack>
    </Stack>
  )
}

