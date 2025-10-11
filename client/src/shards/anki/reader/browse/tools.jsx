import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Stack,
  Typography,
  Input,
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
import { Toolbar } from '../components/Toolbar.jsx'
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

const SearchContent = ({ session }) => {
  const searchQuery = session(state => state.searchQuery) || ''
  const inputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 120)
    return () => clearTimeout(timer)
  }, [])

  const handleChange = (event) => {
    session.setState({ searchQuery: event.target.value })
  }

  return (
    <Box sx={{ p: 2 }}>
      <Input
        inputRef={inputRef}
        value={searchQuery}
        onChange={handleChange}
        placeholder='Search any field or tag'
        startDecorator={<SearchIcon fontSize='small' />}
        size='sm'
        sx={{ borderRadius: 'md' }}
      />
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

export const BrowserTools = ({
  prefs,
  session,
  shardId
}) => {
  const navigate = useNavigate()
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

  const handleSelect = (key) => {
    if (key === 'study') {
      navigate(`/shard/${shardId}/study`)
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

  const buttons = useMemo(() => [
    { key: 'statistics', title: 'Statistics', Icon: BarChart },
    { key: 'study', title: 'Begin study', Icon: PlayArrow, variant: 'solid', color: 'primary', onClick: () => navigate(`/shard/${shardId}/study`) },
    { key: 'settings', title: 'Settings', Icon: Settings },
    { key: 'search', title: 'Search', Icon: SearchIcon }
  ], [navigate, shardId])

  const drawerSize = tool === 'statistics'
    ? '85vh'
    : tool === 'search'
      ? 'auto'
      : tool === 'settings'
        ? 'auto'
        : null

  const drawerContent = useMemo(() => {
    if (tool === 'statistics') {
      return <StatsContent />
    }
    if (tool === 'search') {
      return <SearchContent session={session} />
    }
    if (tool === 'settings') {
      return settingsPages
    }
    return null
  }, [tool, session, settingsPages])

  return (
    <Box sx={{ position: 'relative', zIndex: 100 }}>
      <Toolbar
        visible
        onBack={() => navigate(-1)}
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
