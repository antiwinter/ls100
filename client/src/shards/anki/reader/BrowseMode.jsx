import { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Input,
  Select,
  Option,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemButton,
  Divider
} from '@mui/joy'
import { Search, PlayArrow, Collections, Style } from '@mui/icons-material'
import { parseTemplate } from '../parser/templateParser.js'
import { StudyEngine } from '../engine/studyEngine.js'
import { log } from '../../../utils/logger'

const CardPreview = ({ card, deck: _deck }) => {
  if (!card) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'neutral.500' }}>
        <Collections sx={{ fontSize: '3rem', mb: 1 }} />
        <Typography>Select a card to preview</Typography>
      </Box>
    )
  }

  const { template, fields } = card

  // Parse templates
  const questionHtml = parseTemplate(template.qfmt, fields, { mode: 'question' })
  const answerHtml = parseTemplate(template.afmt, fields, {
    mode: 'answer',
    frontSide: questionHtml
  })

  return (
    <Stack spacing={2} sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Style color="primary" fontSize="small" />
        <Typography level="title-sm">{template.name}</Typography>
        {card.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
            {card.tags.slice(0, 3).map((tag, i) => (
              <Chip key={i} size="sm" variant="soft">
                {tag}
              </Chip>
            ))}
          </Stack>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Question side */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography level="body-sm" color="primary" sx={{ mb: 1, fontWeight: 'bold' }}>
              Question
            </Typography>
            <Box
              sx={{
                '& img': { maxWidth: '100%', height: 'auto' },
                '& .cloze-deletion': {
                  bgcolor: 'warning.100',
                  color: 'warning.800',
                  px: 1,
                  py: 0.5,
                  borderRadius: 'sm',
                  fontWeight: 'bold'
                }
              }}
              dangerouslySetInnerHTML={{ __html: questionHtml }}
            />
          </CardContent>
        </Card>

        {/* Answer side */}
        <Card variant="outlined">
          <CardContent>
            <Typography level="body-sm" color="success" sx={{ mb: 1, fontWeight: 'bold' }}>
              Answer
            </Typography>
            <Box
              sx={{
                '& img': { maxWidth: '100%', height: 'auto' },
                '& .cloze-answer': {
                  bgcolor: 'success.100',
                  color: 'success.800',
                  px: 1,
                  py: 0.5,
                  borderRadius: 'sm',
                  fontWeight: 'bold'
                }
              }}
              dangerouslySetInnerHTML={{ __html: answerHtml }}
            />
          </CardContent>
        </Card>
      </Box>
    </Stack>
  )
}

const CardListItem = ({ card, isSelected, onClick }) => {
  const { template, fields } = card

  // Get first field for preview text
  const firstField = Object.values(fields)[0] || ''
  const previewText = firstField.replace(/<[^>]*>/g, '').substring(0, 100)

  return (
    <ListItem>
      <ListItemButton
        selected={isSelected}
        onClick={onClick}
        sx={{
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0.5,
          py: 1
        }}
      >
        <Typography level="body-sm" sx={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
          {template.name}
        </Typography>
        <Typography
          level="body-xs"
          color="neutral"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {previewText}
        </Typography>
        {card.tags.length > 0 && (
          <Stack direction="row" spacing={0.5}>
            {card.tags.slice(0, 2).map((tag, i) => (
              <Chip key={i} size="sm" variant="outlined">
                {tag}
              </Chip>
            ))}
          </Stack>
        )}
      </ListItemButton>
    </ListItem>
  )
}

const DeckStats = ({ deck, cards }) => {
  const studyEngine = new StudyEngine(deck.id)
  const stats = studyEngine.getStudyStats(cards)
  const dueCards = studyEngine.getDueCards(cards)

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      <Chip size="sm" color="primary">{stats.total} total</Chip>
      <Chip size="sm" color="success">{stats.new} new</Chip>
      <Chip size="sm" color="warning">{stats.learning} learning</Chip>
      <Chip size="sm" color="neutral">{stats.review} review</Chip>
      {dueCards.length > 0 && (
        <Chip size="sm" color="danger">{dueCards.length} due</Chip>
      )}
    </Stack>
  )
}

export const BrowseMode = ({ decks, selectedDeck, onDeckSelect, onStartStudy }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCard, setSelectedCard] = useState(null)
  const [sortBy, setSortBy] = useState('created') // created, modified, random

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    if (!selectedDeck?.cards) return []

    let cards = selectedDeck.cards

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      cards = cards.filter(card => {
        const searchText = Object.values(card.fields).join(' ').toLowerCase()
        const tagText = card.tags.join(' ').toLowerCase()
        return searchText.includes(query) || tagText.includes(query)
      })
    }

    // Sort cards
    switch (sortBy) {
    case 'modified':
      return [...cards].sort((a, b) => new Date(b.modified) - new Date(a.modified))
    case 'random':
      return [...cards].sort(() => Math.random() - 0.5)
    case 'created':
    default:
      return [...cards].sort((a, b) => new Date(b.created) - new Date(a.created))
    }
  }, [selectedDeck, searchQuery, sortBy])

  const handleStartStudy = () => {
    if (!selectedDeck) return

    const studyEngine = new StudyEngine(selectedDeck.id)
    const dueCards = studyEngine.getDueCards(selectedDeck.cards)

    if (dueCards.length === 0) {
      log.warn('No cards due for study')
      return
    }

    onStartStudy(selectedDeck, {
      maxCards: Math.min(20, dueCards.length),
      maxTime: 30 * 60 * 1000 // 30 minutes
    })
  }

  return (
    <Box sx={{ height: '100%', display: 'flex' }}>
      {/* Left sidebar - deck selection and card list */}
      <Box sx={{
        width: 320,
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Deck selection */}
        {decks.length > 1 && (
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Select
              value={selectedDeck?.id || ''}
              onChange={(_, value) => {
                const deck = decks.find(d => d.id === value)
                if (deck) {
                  onDeckSelect(deck)
                  setSelectedCard(null)
                }
              }}
              placeholder="Select deck"
              size="sm"
            >
              {decks.map(deck => (
                <Option key={deck.id} value={deck.id}>
                  {deck.name} ({deck.cards.length} cards)
                </Option>
              ))}
            </Select>
          </Box>
        )}

        {selectedDeck && (
          <>
            {/* Deck stats */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography level="title-sm" sx={{ mb: 1 }}>
                {selectedDeck.name}
              </Typography>
              <DeckStats deck={selectedDeck} cards={selectedDeck.cards} />
              <Button
                startDecorator={<PlayArrow />}
                size="sm"
                sx={{ mt: 2, width: '100%' }}
                onClick={handleStartStudy}
              >
                Start Study Session
              </Button>
            </Box>

            {/* Search and filters */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Input
                placeholder="Search cards..."
                startDecorator={<Search />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                sx={{ mb: 1 }}
              />
              <Select
                value={sortBy}
                onChange={(_, value) => setSortBy(value)}
                size="sm"
              >
                <Option value="created">Created (newest)</Option>
                <Option value="modified">Modified (newest)</Option>
                <Option value="random">Random</Option>
              </Select>
            </Box>

            {/* Card list */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <List size="sm">
                {filteredCards.map((card, index) => (
                  <div key={card.id}>
                    <CardListItem
                      card={card}
                      isSelected={selectedCard?.id === card.id}
                      onClick={() => setSelectedCard(card)}
                    />
                    {index < filteredCards.length - 1 && <Divider />}
                  </div>
                ))}
              </List>

              {filteredCards.length === 0 && (
                <Box sx={{ p: 2, textAlign: 'center', color: 'neutral.500' }}>
                  <Typography level="body-sm">
                    {searchQuery ? 'No cards match your search' : 'No cards available'}
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Right panel - card preview */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <CardPreview card={selectedCard} deck={selectedDeck} />
      </Box>
    </Box>
  )
}
