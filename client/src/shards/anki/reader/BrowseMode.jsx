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

import { StudyEngine } from '../engine/studyEngine.js'
import ankiApi from '../core/ankiApi'
import noteManager from '../core/noteManager'
import { log } from '../../../utils/logger'

const NoteTable = ({ notes, onStartStudy: _onStartStudy }) => {
  const [noteTypes, setNoteTypes] = useState({})
  const [cardCounts, setCardCounts] = useState({})

  useEffect(() => {
    const loadNoteData = async () => {
      const types = {}
      const counts = {}

      for (const note of notes || []) {
        // Get note type
        if (!types[note.typeId]) {
          types[note.typeId] = await noteManager.getType(note.typeId)
        }

        // Get card count for this note
        const cards = await ankiApi.getCardsForDeck('current-deck') // TODO: pass actual deckId
        counts[note.id] = cards.filter(c => c.noteId === note.id).length
      }

      setNoteTypes(types)
      setCardCounts(counts)
    }

    if (notes?.length) {
      loadNoteData()
    }
  }, [notes])

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
            <th style={{ width: '40%' }}>Fields</th>
            <th style={{ width: '20%' }}>Tags</th>
            <th style={{ width: '80px' }}>Cards</th>
            <th style={{ width: '100px' }}>Modified</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note, index) => {
            const noteType = noteTypes[note.typeId]
            const cardCount = cardCounts[note.id] || 0

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
                  <Typography level="body-sm" fontWeight="bold">
                    {cardCount}
                  </Typography>
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
  const [cards, setCards] = useState([])

  // Load notes and cards for selected deck
  useEffect(() => {
    const loadDeckData = async () => {
      if (!selectedDeck?.id) return

      try {
        // Get cards for deck
        const deckCards = await ankiApi.getCardsForDeck(selectedDeck.id)
        setCards(deckCards)

        // Get unique notes from cards
        const noteIds = [...new Set(deckCards.map(c => c.noteId))]
        const deckNotes = await Promise.all(
          noteIds.map(id => noteManager.get(id))
        )

        setNotes(deckNotes.filter(Boolean))
      } catch (err) {
        log.error('Failed to load deck data:', err)
        setNotes([])
        setCards([])
      }
    }

    loadDeckData()
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

  const handleStartStudy = () => {
    if (!selectedDeck || cards.length === 0) return

    try {
      const studyEngine = new StudyEngine(selectedDeck)
      onStartStudy?.(selectedDeck, studyEngine)
      log.info('Started study session for deck:', selectedDeck.name)
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

  const deckStats = {
    notes: notes.length,
    cards: cards.length,
    new: cards.filter(c => c.ctype === 0).length,
    learning: cards.filter(c => c.ctype === 1).length,
    review: cards.filter(c => c.ctype === 2).length,
    due: cards.filter(c => c.due <= Date.now()).length
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Deck Header */}
      <Box sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ mb: 1 }}>
          {selectedDeck.name}
        </Typography>
        {/* Stats */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Chip color="neutral" variant="soft">
            {deckStats.notes} notes
          </Chip>
          <Chip color="neutral" variant="outlined">
            {deckStats.cards} cards
          </Chip>
          <Chip color="primary" variant="soft">
            {deckStats.new} new
          </Chip>
          <Chip color="warning" variant="soft">
            {deckStats.learning} learning
          </Chip>
          <Chip color="success" variant="soft">
            {deckStats.review} review
          </Chip>
          <Chip color="danger" variant="soft">
            {deckStats.due} due
          </Chip>
        </Stack>

        {/* Study Button */}
        <Button
          startDecorator={<PlayArrow />}
          onClick={handleStartStudy}
          disabled={cards.length === 0}
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
        <NoteTable notes={processedNotes} onStartStudy={onStartStudy} />
      </Box>
    </Box>
  )
}
