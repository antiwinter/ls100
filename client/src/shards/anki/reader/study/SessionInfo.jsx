import { useMemo } from 'react'
import {
  Box,
  Stack,
  Typography,
  Button,
  Divider,
  Chip,
  LinearProgress
} from '@mui/joy'

const TimelineBar = ({ slices }) => {
  const total = slices?.reduce((acc, [start, end]) => {
    const s = start || 0
    const e = end == null ? s : end
    return acc + Math.max(0, e - s)
  }, 0) || 0
  if (!total) {
    return (
      <Box sx={{ px: 2 }}>
        <Typography level='body-sm' color='neutral'>No tracked time yet.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', px: 0.5 }}>
      {slices.map(([start, end], index) => {
        const span = Math.max(0, (end || start) - (start || 0))
        const width = `${Math.max(2, (span / total) * 100)}%`
        return (
          <Box
            key={`${start}-${index}`}
            sx={{
              height: 8,
              borderRadius: '999px',
              flexBasis: width,
              flexGrow: 0,
              flexShrink: 0,
              bgcolor: 'primary.softBg',
              minWidth: 6
            }}
          />
        )
      })}
    </Box>
  )
}

export const SessionInfo = ({ session, onAction, onClose }) => {
  const { actions, queue, ttd } = session()

  const stats = useMemo(() => {
    const queueCards = queue?.filter(Boolean) || []
    const newCount = queueCards.filter(c => c?.state === 'New').length
    const reviewCount = queueCards.length - newCount
    const studiedCount = actions?.length || 0
    const totalCount = studiedCount + queueCards.length
    const totalMinutes = Math.round((ttd?.total || 0) / 60)
    const completion = totalCount ? Math.round((studiedCount / totalCount) * 100) : 0

    return {
      studiedCount,
      remainingCount: queueCards.length,
      newCount,
      reviewCount,
      totalCount,
      totalMinutes,
      completion
    }
  }, [actions?.length, queue, ttd?.total])

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack spacing={0.75}>
        <Typography level='title-sm'>Session timeline</Typography>
        <TimelineBar slices={ttd?.slices || []} />
        <Typography level='body-xs' color='neutral'>
          {stats.totalMinutes > 0 ? `${stats.totalMinutes} minutes focused` : 'Tracking starts when you rate cards'}
        </Typography>
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography level='title-sm'>Learning progress</Typography>
        <LinearProgress determinate value={stats.completion} thickness={6} />
        <Typography level='body-sm' color='neutral'>
          {stats.studiedCount} studied · {
            stats.remainingCount} remaining ({stats.completion}% complete)
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <Typography level='title-sm'>Learning status</Typography>
        <Stack direction='row' spacing={1}>
          <Chip size='sm' variant='soft' color='primary'>New {stats.newCount}</Chip>
          <Chip size='sm' variant='outlined' color='neutral'>Review {stats.reviewCount}</Chip>
        </Stack>
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography level='title-sm'>Operations</Typography>
        <Button variant='solid' color='danger' size='sm' onClick={async () => { await onAction?.('reset-session'); onClose?.() }}>
          Reset session
        </Button>
        <Button variant='outlined' color='neutral' size='sm' onClick={async () => { await onAction?.('rebuild-session'); onClose?.() }}>
          Rebuild session
        </Button>
      </Stack>
    </Stack>
  )
}

