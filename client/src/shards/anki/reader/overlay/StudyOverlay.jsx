import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Box,
  Stack,
  Typography,
  Button,
  Divider,
  Chip,
  LinearProgress,
  Textarea,
  Alert
} from '@mui/joy'
import {
  Undo as UndoIcon,
  Edit as EditIcon,
  Assessment,
  Style
} from '@mui/icons-material'
import { fsrs as createFsrs } from 'ts-fsrs'
import db from '../../core/db.js'
import anki from '../../core/index.js'
import { Toolbar } from './Toolbar.jsx'
import { ActionDrawer } from '../../../../components/ActionDrawer.jsx'
import { log } from '../../../../utils/logger'

const fsrsModel = createFsrs({})

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

const SessionContent = ({ stats, onReset, onRebuild, onClose }) => {
  const { studiedCount, remainingCount, newCount, reviewCount, totalCount, ttd } = stats || {}
  const totalMinutes = Math.round((ttd?.total || 0) / 60)
  const completion = totalCount ? Math.round((studiedCount / totalCount) * 100) : 0

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack spacing={0.75}>
        <Typography level='title-sm'>Session timeline</Typography>
        <TimelineBar slices={ttd?.slices || []} />
        <Typography level='body-xs' color='neutral'>
          {totalMinutes > 0 ? `${totalMinutes} minutes focused` : 'Tracking starts when you rate cards'}
        </Typography>
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography level='title-sm'>Learning progress</Typography>
        <LinearProgress determinate value={completion} thickness={6} />
        <Typography level='body-sm' color='neutral'>
          {studiedCount} studied · {remainingCount} remaining ({completion}% complete)
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <Typography level='title-sm'>Learning status</Typography>
        <Stack direction='row' spacing={1}>
          <Chip size='sm' variant='soft' color='primary'>New {newCount}</Chip>
          <Chip size='sm' variant='outlined' color='neutral'>Review {reviewCount}</Chip>
        </Stack>
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography level='title-sm'>Operations</Typography>
        <Button variant='solid' color='danger' size='sm' onClick={async () => { await onReset?.(); onClose?.() }}>
          Reset session
        </Button>
        <Button variant='outlined' color='neutral' size='sm' onClick={async () => { await onRebuild?.(); onClose?.() }}>
          Rebuild session
        </Button>
      </Stack>
    </Stack>
  )
}

const EditContent = ({ card, onSaved }) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState([])
  const [fieldDefs, setFieldDefs] = useState([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!card?.noteId) {
        setFields([])
        setFieldDefs([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const note = await db.notes.get(card.noteId)
        const bundle = await anki.getBundle(card.bundleId)
        if (!alive) return
        setFields(note?.fields || [])
        setFieldDefs(bundle?.fields || [])
      } catch (err) {
        log.error('Failed to load note for editing', err)
        if (alive) setError('Unable to load note fields')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [card?.noteId, card?.bundleId])

  const handleFieldChange = (index, value) => {
    setFields((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleSave = async () => {
    if (!card?.noteId) return
    setSaving(true)
    setError(null)
    try {
      await anki.noteManager.update(card.noteId, fields, undefined)
      onSaved?.(true)
    } catch (err) {
      log.error('Failed to save note fields', err)
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography level='body-sm' color='neutral'>Loading fields…</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert color='danger'>{error}</Alert>
      </Box>
    )
  }

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      {fields.map((value, index) => (
        <Stack key={index} spacing={0.5}>
          <Typography level='body-sm' color='neutral'>
            {fieldDefs[index]?.name || fieldDefs[index] || `Field ${index + 1}`}
          </Typography>
          <Textarea
            minRows={3}
            value={value || ''}
            onChange={(event) => handleFieldChange(index, event.target.value)}
          />
        </Stack>
      ))}

      <Stack direction='row' spacing={1} justifyContent='flex-end'>
        <Button variant='outlined' color='neutral' size='sm' disabled={saving} onClick={() => onSaved?.(false)}>
          Cancel
        </Button>
        <Button variant='solid' size='sm' onClick={handleSave} loading={saving}>
          Save changes
        </Button>
      </Stack>
    </Stack>
  )
}

const CardContent = ({ card, onBury, onSuspend, onClose }) => {
  const latest = card?.fsrs?.[0]
  const stability = latest?.stability || 0
  const difficulty = latest?.difficulty || 0
  const dueDate = latest?.due ? new Date(latest.due) : card?.due ? new Date(card.due) : null
  const intervals = useMemo(() => [1, 3, 7, 14, 30], [])

  const forgetting = useMemo(() => {
    if (!stability) return []
    return intervals.map((day) => {
      const value = fsrsModel.forgetting_curve(day, stability)
      return {
        day,
        value: Math.max(0, Math.min(1, value))
      }
    })
  }, [intervals, stability])

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
        <Button variant='outlined' color='neutral' size='sm' onClick={async () => { await onBury?.(); onClose?.() }}>
          Bury card
        </Button>
        <Button variant='solid' color='danger' size='sm' onClick={async () => { await onSuspend?.(); onClose?.() }}>
          Suspend card
        </Button>
      </Stack>
    </Stack>
  )
}

export const StudyOverlay = ({
  title,
  onBack,
  canUndo,
  onUndo,
  onResetSession,
  onRebuildSession,
  sessionStats,
  card,
  onCardSaved,
  onBury,
  onSuspend
}) => {
  const [tool, setTool] = useState(null)
  const drawerRef = useRef(null)

  const buttons = useMemo(() => [
    { key: 'undo', title: 'Undo', Icon: UndoIcon, disabled: !canUndo },
    { key: 'edit', title: 'Edit note', Icon: EditIcon },
    { key: 'session', title: 'Session', Icon: Assessment },
    { key: 'card', title: 'Card info', Icon: Style }
  ], [canUndo])

  const handleSelect = (key) => {
    if (key === 'undo') {
      onUndo?.()
      return
    }
    setTool((prev) => prev === key ? null : key)
  }

  useEffect(() => {
    if (tool && drawerRef.current) {
      drawerRef.current.resetScroll?.()
      drawerRef.current.snap?.(0)
    }
  }, [tool])

  const drawerSize = tool === 'edit' ? '85vh'
    : tool === 'session' ? '70vh'
      : tool === 'card' ? '60vh'
        : null

  const drawerContent = useMemo(() => {
    if (tool === 'edit') {
      return (
        <EditContent
          card={card}
          onSaved={(shouldRefresh) => {
            if (shouldRefresh) onCardSaved?.()
            setTool(null)
          }}
        />
      )
    }
    if (tool === 'session') {
      return (
        <SessionContent
          stats={sessionStats}
          onReset={onResetSession}
          onRebuild={onRebuildSession}
          onClose={() => setTool(null)}
        />
      )
    }
    if (tool === 'card') {
      return (
        <CardContent
          card={card}
          onBury={onBury}
          onSuspend={onSuspend}
          onClose={() => setTool(null)}
        />
      )
    }
    return null
  }, [tool, card, sessionStats, onResetSession, onRebuildSession, onBury, onSuspend, onCardSaved])

  return (
    <Box sx={{ position: 'relative', zIndex: 100 }}>
      <Toolbar
        visible
        title={title || 'Study session'}
        onBack={onBack}
        buttons={buttons}
        activeKey={tool}
        onSelect={handleSelect}
      />

      <ActionDrawer
        ref={drawerRef}
        size={drawerSize}
        position='bottom'
        onClose={() => setTool(null)}
      >
        {drawerContent}
      </ActionDrawer>
    </Box>
  )
}
