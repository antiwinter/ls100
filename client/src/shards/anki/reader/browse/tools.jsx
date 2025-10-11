import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Stack,
  Typography,
  Input
} from '@mui/joy'
import {
  BarChart,
  PlayArrow,
  Settings,
  Search as SearchIcon
} from '@mui/icons-material'
import { Toolbar } from '../components/Toolbar.jsx'
import { ActionDrawer } from '../../../../components/ActionDrawer.jsx'
import { buildSettingsPages } from './Settings.jsx'

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

  const handleSelect = useCallback((key) => {
    if (key === 'study') {
      navigate(`/shard/${shardId}/study`)
      return
    }
    setTool((prev) => prev === key ? null : key)
  }, [navigate, shardId])

  const handleClose = useCallback(() => {
    setTool(null)
  }, [])

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
        onClose={handleClose}
      >
        {drawerContent}
      </ActionDrawer>
    </Box>
  )
}
