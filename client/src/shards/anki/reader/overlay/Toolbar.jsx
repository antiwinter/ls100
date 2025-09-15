import {
  Box,
  Stack,
  IconButton,
  Typography
} from '@mui/joy'
import {
  ArrowBack,
  BarChart,
  PlayArrow,
  Settings,
  Search
} from '@mui/icons-material'
import { AnkiSessionStore } from '../../core/sessionStore.js'
import { log } from '../../../../utils/logger'

// Button styles for consistency
const btnSx = {
  minHeight: 'auto',
  p: 1,
  borderRadius: 'sm'
}

// Toolbar buttons in order
const TOOLS = [
  { key: 'statistics', title: 'Statistics', Icon: BarChart },
  { key: 'study', title: 'Begin Study', Icon: PlayArrow, color: 'primary', variant: 'soft' },
  { key: 'settings', title: 'Settings', Icon: Settings },
  { key: 'search', title: 'Search', Icon: Search }
]

// Anki reader toolbar with study tools
export const Toolbar = ({
  shardId,
  onBack,
  onToolSelect
}) => {
  const _sessionStore = AnkiSessionStore(shardId)

  const handleToolClick = (tool) => {
    log.debug('Anki tool selected:', tool)
    onToolSelect?.(tool)
  }

  return (
    <Box
      sx={{
        py: 2,
        px: 3,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.surface'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {/* Left side: Back button + Title */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            onClick={onBack}
            variant="plain"
            size="sm"
            sx={btnSx}
            title="Back"
          >
            <ArrowBack />
          </IconButton>
          <Typography level="title-md" color="neutral">
            Browse Notes
          </Typography>
        </Stack>

        {/* Right side: Tool buttons */}
        <Stack direction="row" spacing={1} alignItems="center">
          {TOOLS.map((tool) => (
            <IconButton
              key={tool.key}
              onClick={() => handleToolClick(tool.key)}
              variant={tool.variant || 'plain'}
              color={tool.color || 'neutral'}
              size="sm"
              sx={btnSx}
              title={tool.title}
            >
              <tool.Icon />
            </IconButton>
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}
