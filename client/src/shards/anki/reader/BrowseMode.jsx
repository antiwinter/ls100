import { useState, useMemo, useEffect } from 'react'
import {
  Box,
  Typography,
  Input,
  Select,
  Option,
  Button,
  Stack,
  Chip,
  Table,
  Sheet
} from '@mui/joy'
import { Search, PlayArrow, Collections } from '@mui/icons-material'

import ankiApi from '../core/ankiApi'
import noteManager from '../core/noteManager'
import { log } from '../../../utils/logger'

const NoteTable = ({ notes, noteTypes, onStartStudy: _onStartStudy }) => {

  if (!notes || notes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Collections sx={{ fontSize: 48, color: 'neutral.400', mb: 2 }} />
        <Typography color="neutral">No notes found</Typography>
      </Box>
    )
  }

  return (
    <Sheet variant="outlined" sx={{ borderRadius: 'sm' }}>
      <Table hoverRow stickyHeader>
        <thead>
          <tr>
            <th style={{ width: '60px' }}>#</th>
            <th style={{ width: '120px' }}>Type</th>
            <th style={{ width: '45%' }}>Fields</th>
            <th style={{ width: '25%' }}>Tags</th>
            <th style={{ width: '100px' }}>Modified</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note, index) => {
            const noteType = noteTypes[note.typeId]

            return (
              <tr key={note.id}>
                <td>
                  <Typography level="body-sm" fontWeight="bold">
                    {index + 1}
                  </Typography>
                </td>
                <td>
                  <Chip size="sm" variant="soft" color="primary">
                    {noteType?.name || note.typeId}
                  </Chip>
                </td>
                <td>
                  <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                    {noteType?.fields.map((fieldName, i) => (
                      <Typography
                        key={i}
                        level="body-sm"
                        sx={{
                          mb: 0.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <strong>{fieldName}:</strong> {(note.fields[i] || '').replace(/<[^>]*>/g, '')}
                      </Typography>
                    )) || (
                      <Typography level="body-sm" color="neutral">
                        {note.fields.join(' | ').substring(0, 100)}...
                      </Typography>
                    )}
                  </Box>
                </td>
                <td>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {note.tags?.slice(0, 3).map((tag, i) => (
                      <Chip key={i} size="sm" variant="outlined" color="neutral">
                        {tag}
                      </Chip>
                    ))}
                    {note.tags?.length > 3 && (
                      <Chip size="sm" variant="outlined" color="neutral">
                        +{note.tags.length - 3}
                      </Chip>
                    )}
                  </Stack>
                </td>
                <td>
                  <Typography level="body-xs" color="neutral">
                    {new Date(note.modified).toLocaleDateString()}
                  </Typography>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Sheet>
  )
}

export const BrowseMode = ({
  decks: _decks = [],
  selectedDeck = null,
  onStartStudy
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created')
  const [notes, setNotes] = useState([])
  const [noteTypes, setNoteTypes] = useState({})


  // Load notes for selected shard
  useEffect(() => {
    const loadNotesData = async () => {
      if (!selectedDeck?.id) {
        setNotes([])
        setNoteTypes({})
        return
      }


      try {
        // Get notes for this shard by finding cards first, then getting unique notes
        const shardCards = await ankiApi.getCardsForShard(selectedDeck.id)
        const noteIds = [...new Set(shardCards.map(c => c.noteId))]

        const shardNotes = await Promise.all(
          noteIds.map(async (id) => {
            try {
              return await noteManager.get(id)
            } catch (err) {
              log.warn('Failed to load note:', id, err)
              return null
            }
          })
        )
        const validNotes = shardNotes.filter(Boolean)

        // Load note types for the notes
        const types = {}
        for (const note of validNotes) {
          if (!types[note.typeId]) {
            types[note.typeId] = await noteManager.getType(note.typeId)
          }
        }

        setNotes(validNotes)
        setNoteTypes(types)
        log.debug('Loaded shard notes:', {
          notes: validNotes.length,
          noteTypes: Object.keys(types).length
        })
      } catch (error) {
        log.error('Failed to load notes data:', error)
        setNotes([])
        setNoteTypes({})
      } finally {
        // Loading complete
      }
    }

    loadNotesData()
  }, [selectedDeck])

  // Process and filter notes
  const processedNotes = useMemo(() => {
    let filteredNotes = [...notes]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredNotes = filteredNotes.filter(note => {
        const fieldsText = note.fields.join(' ').toLowerCase()
        const tagText = note.tags?.join(' ').toLowerCase() || ''
        return fieldsText.includes(query) || tagText.includes(query)
      })
    }

    // Sort notes
    switch (sortBy) {
    case 'modified':
      return [...filteredNotes].sort((a, b) => new Date(b.modified) - new Date(a.modified))
    case 'created':
      return [...filteredNotes].sort((a, b) => new Date(a.created) - new Date(b.created))
    case 'type':
      return [...filteredNotes].sort((a, b) => a.typeId.localeCompare(b.typeId))
    default:
      return filteredNotes
    }
  }, [notes, searchQuery, sortBy])

  const noteStats = useMemo(() => {
    if (!notes.length) return { total: 0, noteTypes: {}, tags: {} }

    const typeStats = {}
    const tagStats = {}

    for (const note of notes) {
      // Count by note type
      const typeName = noteTypes[note.typeId]?.name || 'Unknown'
      typeStats[typeName] = (typeStats[typeName] || 0) + 1

      // Count by tags
      for (const tag of note.tags || []) {
        tagStats[tag] = (tagStats[tag] || 0) + 1
      }
    }

    return {
      total: notes.length,
      noteTypes: typeStats,
      tags: tagStats,
      avgFieldsPerNote: notes.reduce((sum, note) => {
        return sum + (note.fields?.length || 0)
      }, 0) / notes.length
    }
  }, [notes, noteTypes])

  const handleStartStudy = () => {
    if (!selectedDeck || notes.length === 0) return
    try {
      onStartStudy?.()
      log.info('Requested study session for deck:', selectedDeck.name)
    } catch (error) {
      log.error('Failed to start study session:', error)
    }
  }

  if (!selectedDeck) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Select a deck to browse notes</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Deck Header */}
      <Box sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ mb: 1 }}>
          {selectedDeck.name}
        </Typography>
        {/* Note Statistics */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Chip color="primary" variant="soft">
            {noteStats.total} notes
          </Chip>
          {Object.entries(noteStats.noteTypes).map(([typeName, count]) => (
            <Chip key={typeName} color="neutral" variant="outlined">
              {count} {typeName}
            </Chip>
          ))}
          {Object.keys(noteStats.tags).length > 0 && (
            <Chip color="success" variant="soft">
              {Object.keys(noteStats.tags).length} unique tags
            </Chip>
          )}
        </Stack>

        {/* Study Button */}
        <Button
          startDecorator={<PlayArrow />}
          onClick={handleStartStudy}
          disabled={notes.length === 0}
          sx={{ mb: 2 }}
        >
          Start Study Session
        </Button>
      </Box>

      {/* Controls */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Input
          placeholder="Search notes..."
          startDecorator={<Search />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Select
          value={sortBy}
          onChange={(_, value) => setSortBy(value)}
          sx={{ minWidth: 140 }}
        >
          <Option value="created">Created</Option>
          <Option value="modified">Modified</Option>
          <Option value="type">Note Type</Option>
        </Select>
      </Stack>

      {/* Results Count */}
      {searchQuery && (
        <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
          {processedNotes.length} notes found
        </Typography>
      )}

      {/* Notes Table */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <NoteTable notes={processedNotes} noteTypes={noteTypes} onStartStudy={onStartStudy} />
      </Box>
    </Box>
  )
}
