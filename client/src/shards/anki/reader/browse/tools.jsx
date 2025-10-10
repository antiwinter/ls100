import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Box,
  Stack,
  Typography,
  Input,
  Chip,
  Divider,
  Select,
  Option,
  Switch,
  FormControl,
  FormLabel
} from '@mui/joy'
import {
  BarChart,
  PlayArrow,
  Settings,
  Search as SearchIcon
} from '@mui/icons-material'
import Fuse from 'fuse.js'
import { Toolbar } from './Toolbar.js'
import { ActionDrawer } from '../../../../components/ActionDrawer.jsx'

const StatsContent = () => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography level='title-sm' sx={{ mb: 1 }}>
        Study statistics
      </Typography>
      <Typography level='body-sm' color='neutral'>
        Statistics dashboard coming soon. Track your reviews, streaks, and accuracy here.
      </Typography>
    </Box>
  )
}

const ResultRow = ({ summary, onSelect }) => {
  const { card, primary, secondary, note } = summary
  return (
    <Box
      onClick={() => onSelect?.(card)}
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: 'md',
        '&:hover': {
          bgcolor: 'neutral.softBg'
        }
      }}
    >
      <Stack spacing={0.5}>
        <Typography level='body-md' sx={{ fontWeight: 600 }}>
          {primary}
        </Typography>
        {secondary && (
          <Typography level='body-sm' color='neutral'>
            {secondary}
          </Typography>
        )}
        {Array.isArray(note?.tags) && note.tags.length > 0 && (
          <Stack direction='row' spacing={0.75} sx={{ flexWrap: 'wrap' }}>
            {note.tags.slice(0, 4).map((tag) => (
              <Chip key={tag} size='sm' variant='soft' color='neutral'>
                {tag.trim()}
              </Chip>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}

const SearchContent = ({
  summaries,
  fuse,
  onResults,
  onLocate,
  total
}) => {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState(summaries)
  const inputRef = useRef(null)

  useEffect(() => {
    setHits(summaries)
    if (!query) onResults('', summaries.map(s => s.card))
  }, [summaries, query, onResults])

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 120)
    return () => clearTimeout(timer)
  }, [])

  const runSearch = (value) => {
    const term = value.trim()
    setQuery(value)
    if (!term) {
      setHits(summaries)
      onResults('', summaries.map(s => s.card))
      return
    }
    const results = fuse ? fuse.search(term) : []
    const mapped = results.length > 0
      ? results.map(entry => entry.item)
      : []
    setHits(mapped)
    onResults(term, mapped.map(s => s.card))
  }

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Input
        inputRef={inputRef}
        value={query}
        onChange={(event) => runSearch(event.target.value)}
        placeholder='Search any field or tag'
        startDecorator={<SearchIcon fontSize='small' />}
        size='sm'
        sx={{ borderRadius: 'md' }}
      />

      <Typography level='body-sm' color='neutral'>
        Showing {hits.length} of {total} cards
      </Typography>

      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
        <Stack spacing={1.25}>
          {hits.map((summary) => (
            <ResultRow
              key={summary.card.id}
              summary={summary}
              onSelect={onLocate}
            />
          ))}
          {hits.length === 0 && (
            <Typography level='body-sm' color='neutral'>
              No matching cards. Try another query.
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  )
}

const NumberField = ({ label, value, onChange, min = 0, max = 999 }) => {
  return (
    <FormControl size='sm'>
      <FormLabel>{label}</FormLabel>
      <Input
        type='number'
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isNaN(next)) return
          const clamped = Math.min(max, Math.max(min, next))
          onChange(clamped)
        }}
        sx={{ mt: 0.5 }}
      />
    </FormControl>
  )
}

const ToggleField = ({ label, checked, onChange }) => {
  return (
    <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <FormLabel>{label}</FormLabel>
      <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} size='sm' />
    </FormControl>
  )
}

const buildSettingsPages = (state, update) => [
  {
    key: 'browse',
    title: 'Browse options',
    content: (
      <Stack spacing={1.5}>
        <FormControl size='sm'>
          <FormLabel>Preview side</FormLabel>
          <Select
            value={state.previewSide || 'back'}
            onChange={(_, value) => update({ previewSide: value })}
            size='sm'
          >
            <Option value='both'>Both sides</Option>
            <Option value='front'>Front only</Option>
            <Option value='back'>Back only</Option>
          </Select>
        </FormControl>
      </Stack>
    )
  },
  {
    key: 'learning',
    title: 'Learning options',
    content: (
      <Stack spacing={1.5}>
        <NumberField
          label='Max new cards per day'
          value={state.maxNewCards}
          min={1}
          max={200}
          onChange={(value) => update({ maxNewCards: value })}
        />
        <NumberField
          label='Max review cards per day'
          value={state.maxReviewCards}
          min={10}
          max={1000}
          onChange={(value) => update({ maxReviewCards: value })}
        />
        <NumberField
          label='Daily reset time (hour)'
          value={state.dailyResetTime}
          min={0}
          max={23}
          onChange={(value) => update({ dailyResetTime: value })}
        />
        <NumberField
          label='Graduation gap (minutes)'
          value={state.gradCd}
          min={1}
          max={720}
          onChange={(value) => update({ gradCd: value })}
        />

        <Divider sx={{ my: 1 }} />
        <ToggleField
          label='Auto reveal answer'
          checked={!!state.autoReveal}
          onChange={(value) => update({ autoReveal: value })}
        />
        <ToggleField
          label='Auto play audio'
          checked={!!state.autoPlayAudio}
          onChange={(value) => update({ autoPlayAudio: value })}
        />

        <Divider sx={{ my: 1 }} />
        <FormControl size='sm'>
          <FormLabel>New vs review order</FormLabel>
          <Select
            value={state.newReviewOrder || 'mixed'}
            onChange={(_, value) => update({ newReviewOrder: value })}
            size='sm'
          >
            <Option value='mixed'>Mixed</Option>
            <Option value='new-first'>New cards first</Option>
            <Option value='review-first'>Reviews first</Option>
          </Select>
        </FormControl>
        <FormControl size='sm'>
          <FormLabel>New card ordering</FormLabel>
          <Select
            value={state.newCardOrder || 'gather'}
            onChange={(_, value) => update({ newCardOrder: value })}
            size='sm'
          >
            <Option value='gather'>Template order</Option>
            <Option value='random'>Random</Option>
            <Option value='template-random'>Random within template</Option>
          </Select>
        </FormControl>

        <ToggleField
          label='Auto bury siblings'
          checked={!!state.autoBurySiblings}
          onChange={(value) => update({ autoBurySiblings: value })}
        />
        <ToggleField
          label='Use natural cooldown'
          checked={!!state.naturalCooldown}
          onChange={(value) => update({ naturalCooldown: value })}
        />
      </Stack>
    )
  }
]

export const ViewerOverlay = ({
  title,
  cards,
  notes,
  prefs,
  onBack,
  onStudy,
  onSearchChange,
  onLocateCard
}) => {
  const drawerRef = useRef(null)
  const [tool, setTool] = useState(null)

  const prefState = prefs()
  const setPreferences = prefState.setPreferences

  const updatePrefs = useCallback((patch) => {
    setPreferences?.(patch)
  }, [setPreferences])

  const settingsPages = useMemo(
    () => buildSettingsPages(prefState, updatePrefs),
    [prefState, updatePrefs]
  )

  const summaries = useMemo(() => {
    const map = notes instanceof Map ? notes : new Map(Object.entries(notes || {}))
    return cards.map((card) => {
      const note = map.get(card.noteId)
      const fields = note?.fields || []
      return {
        card,
        note,
        cardId: card.id,
        primary: fields[0] || `Card ${card.id.slice(0, 6)}`,
        secondary: fields.slice(1).filter(Boolean).join(' • '),
        text: fields.join(' '),
        tags: note?.tags || []
      }
    })
  }, [cards, notes])

  const fuse = useMemo(() => {
    if (!summaries.length) return null
    return new Fuse(summaries, {
      includeScore: true,
      threshold: 0.32,
      keys: [
        { name: 'primary', weight: 0.5 },
        { name: 'text', weight: 0.4 },
        { name: 'tags', weight: 0.1 }
      ]
    })
  }, [summaries])

  useEffect(() => {
    if (!tool) onSearchChange?.('', cards)
  }, [tool, cards, onSearchChange])

  const handleSelect = (key) => {
    if (key === 'study') {
      onStudy?.()
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

  const handleSearchResults = useCallback((query, filtered) => {
    onSearchChange?.(query, filtered)
  }, [onSearchChange])

  const buttons = useMemo(() => [
    { key: 'statistics', title: 'Statistics', Icon: BarChart },
    { key: 'study', title: 'Begin study', Icon: PlayArrow, variant: 'solid', color: 'primary', onClick: () => onStudy?.() },
    { key: 'settings', title: 'Settings', Icon: Settings },
    { key: 'search', title: 'Search', Icon: SearchIcon }
  ], [onStudy])

  const drawerSize = tool === 'statistics'
    ? '85vh'
    : tool === 'search'
      ? '45vh'
      : tool === 'settings'
        ? 'auto'
        : null

  const drawerContent = useMemo(() => {
    if (tool === 'statistics') {
      return <StatsContent />
    }
    if (tool === 'search') {
      return (
        <SearchContent
          summaries={summaries}
          fuse={fuse}
          total={cards.length}
          onResults={handleSearchResults}
          onLocate={onLocateCard}
        />
      )
    }
    if (tool === 'settings') {
      return settingsPages
    }
    return null
  }, [tool, summaries, fuse, cards.length, settingsPages, onLocateCard, handleSearchResults])

  return (
    <Box sx={{ position: 'relative', zIndex: 100 }}>
      <Toolbar
        visible
        title={title || 'Browse notes'}
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
