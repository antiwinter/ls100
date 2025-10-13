import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
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
import { BrowseSettings, LearningSettings } from './Settings.jsx'

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

const BrowserTools_ = forwardRef(({ prefs, session }, ref) => {
  const navigate = useNavigate()
  const drawerRef = useRef(null)
  const [tool, setTool] = useState(null)
  const [toolbarVisible, setToolbarVisible] = useState(false)
  const { shard } = session()

  const handleSelect = useCallback((key) => {
    if (key === 'study') {
      navigate(`/shard/${shard.id}/study`)
      return
    }
    setTool((prev) => prev === key ? null : key)
  }, [navigate, shard.id])

  const handleClose = useCallback(() => {
    setTool(null)
  }, [])

  useEffect(() => {
    if (tool && drawerRef.current) {
      drawerRef.current.resetScroll?.()
      drawerRef.current.snap?.(0)
    }
  }, [tool])

  useImperativeHandle(ref, () => ({
    toggleToolbar: () => {
      setToolbarVisible(prev => !prev)
    }
  }))

  const buttons = useMemo(() => [
    { key: 'statistics', title: 'Statistics', Icon: BarChart },
    { key: 'study', title: 'Begin study', Icon: PlayArrow,
      onClick: () => navigate(`/shard/${shard.id}/study`) },
    { key: 'settings', title: 'Settings', Icon: Settings },
    { key: 'search', title: 'Search', Icon: SearchIcon }
  ], [navigate, shard.id])

  const drawerSize = tool === 'statistics' ? '85vh' : 'auto'

  return (
    <Box>
      <Toolbar
        visible={toolbarVisible}
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
        {tool === 'statistics' && <StatsContent />}
        {tool === 'search' && <SearchContent session={session} />}
        {tool === 'settings' && <BrowseSettings prefs={prefs} session={session} />}
        {tool === 'settings' && <LearningSettings prefs={prefs} session={session} />}
      </ActionDrawer>
    </Box>
  )
})

export const BrowserTools = BrowserTools_
BrowserTools.displayName = 'BrowserTools'
