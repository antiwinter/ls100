import { useState, useMemo } from 'react'
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
import { log } from '../../../utils/logger'

const CardTable = ({ cards, onStartStudy: _onStartStudy }) => {
  if (!cards || cards.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Collections sx={{ fontSize: 48, color: 'neutral.400', mb: 2 }} />
        <Typography color="neutral">No cards found</Typography>
      </Box>
    )
  }

  return (
    <Sheet variant="outlined" sx={{ borderRadius: 'sm' }}>
      <Table hoverRow stickyHeader>
        <thead>
          <tr>
            <th style={{ width: '80px' }}>#</th>
            <th style={{ width: '45%' }}>Question</th>
            <th style={{ width: '45%' }}>Answer</th>
            <th style={{ width: '120px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card, index) => (
            <tr key={card.id}>
              <td>
                <Typography level="body-sm" fontWeight="bold">
                  {index + 1}
                </Typography>
              </td>
              <td>
                <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                  <Typography
                    level="body-sm"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {(() => {
                      const questionText = card.question || 'Content unavailable'
                      log.debug('Card question rendering:', {
                        cardId: card.id,
                        hasQuestion: !!card.question,
                        questionValue: card.question,
                        questionType: typeof card.question,
                        cardStructure: Object.keys(card)
                      })
                      return questionText.replace(/<[^>]*>/g, '')
                    })()}
                  </Typography>
                </Box>
              </td>
              <td>
                <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                  <Typography
                    level="body-sm"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {(() => {
                      const answerText = card.answer || 'Content unavailable'
                      log.debug('Card answer rendering:', {
                        cardId: card.id,
                        hasAnswer: !!card.answer,
                        answerValue: card.answer,
                        answerType: typeof card.answer,
                        fullCard: card
                      })
                      return answerText.replace(/<[^>]*>/g, '')
                    })()}
                  </Typography>
                </Box>
              </td>
              <td>
                <Chip
                  size="sm"
                  color={card.type === 0 ? 'primary' : card.type === 1 ? 'warning' : 'success'}
                  variant="soft"
                >
                  {card.type === 0 ? 'New' : card.type === 1 ? 'Learning' : 'Review'}
                </Chip>
              </td>
            </tr>
          ))}
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

  // Get cards from selected deck
  const cards = useMemo(() => {
    const deckCards = selectedDeck?.cards || []
    log.debug('BrowseMode cards:', {
      deckName: selectedDeck?.name,
      cardCount: deckCards.length,
      sampleCard: deckCards[0],
      cardKeys: deckCards[0] ? Object.keys(deckCards[0]) : [],
      allCards: deckCards
    })
    return deckCards
  }, [selectedDeck])

  // Process and filter cards
  const processedCards = useMemo(() => {
    let filteredCards = [...cards]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredCards = filteredCards.filter(card => {
        const searchText = `${card.question || ''} ${card.answer || ''}`.toLowerCase()
        const tagText = card.tags?.join(' ').toLowerCase() || ''
        return searchText.includes(query) || tagText.includes(query)
      })
    }

    // Sort cards
    switch (sortBy) {
    case 'modified':
      return [...filteredCards].sort((a, b) => new Date(b.modified) - new Date(a.modified))
    case 'created':
      return [...filteredCards].sort((a, b) => a.id - b.id)
    case 'due':
      return [...filteredCards].sort((a, b) => a.due - b.due)
    default:
      return filteredCards
    }
  }, [cards, searchQuery, sortBy])

  const handleStartStudy = () => {
    if (!selectedDeck || processedCards.length === 0) return

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
        <Typography color="neutral">Select a deck to browse cards</Typography>
      </Box>
    )
  }

  const deckStats = {
    total: cards.length,
    new: cards.filter(c => c.type === 0).length,
    learning: cards.filter(c => c.type === 1).length,
    review: cards.filter(c => c.type === 2).length,
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
            {deckStats.total} total
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
          disabled={processedCards.length === 0}
          sx={{ mb: 2 }}
        >
          Start Study Session
        </Button>
      </Box>

      {/* Controls */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Input
          placeholder="Search cards..."
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
          <Option value="created">Created (newest)</Option>
          <Option value="modified">Modified</Option>
          <Option value="due">Due date</Option>
        </Select>
      </Stack>

      {/* Results Count */}
      {searchQuery && (
        <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
          {processedCards.length} cards found
        </Typography>
      )}

      {/* Cards Table */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <CardTable cards={processedCards} onStartStudy={onStartStudy} />
      </Box>
    </Box>
  )
}
