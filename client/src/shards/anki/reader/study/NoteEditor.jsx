import { useState, useEffect } from 'react'
import {
  Box,
  Stack,
  Typography,
  Button,
  Textarea,
  Alert
} from '@mui/joy'
import db from '../../core/db.js'
import anki from '../../core/index.js'
import { log } from '../../../../utils/logger.js'

export const NoteEditor = ({ card, onSaved }) => {
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

