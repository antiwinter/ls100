import {
  Stack,
  Typography,
  Input,
  List,
  ListItem,
  ListItemButton,
  IconButton
} from '@mui/joy'
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material'
import { useSessionStore } from './stores/useSessionStore'
import { formatSec } from '../../utils/dateFormat'

export const SearchContent = ({ shardId, onSeek }) => {
  const sessionStore = useSessionStore(shardId)
  const { searchResults, searchQuery, setSearchQuery } = sessionStore()

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
  }

  const handleClear = () => {
    setSearchQuery('')
  }

  const handleResultClick = (result) => {
    // leave 3 rows ahead to make the row visible
    onSeek?.(Math.max(0, result.gid - 3))
  }

  return (
    <Stack sx={{ height: '100%' }}>
      <Input
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder='Search subtitles...'
        startDecorator={<SearchIcon />}
        endDecorator={
          searchQuery && (
            <IconButton size='sm' onClick={handleClear}>
              <ClearIcon />
            </IconButton>
          )
        }
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          mx: 1,
          mt: 1,
          bgcolor: 'background.body'
        }}
      />

      {searchResults?.length > 0 && (
        <List
          size='sm'
          sx={{
            flex: 1,
            overflow: 'auto',
            mx: 1,
            mt: 1,
            mb: 1
          }}
        >
          {searchResults.map((result, idx) => (
            <ListItem key={idx}>
              <ListItemButton
                onClick={() => handleResultClick(result)}
                sx={{ borderRadius: 'md' }}
              >
                <Stack spacing={0.5} sx={{ width: '100%' }}>
                  <Stack direction='row' justifyContent='space-between' alignItems='center'>
                    <Typography
                      level='body-xs'
                      sx={{
                        color: 'neutral.400',
                        fontFamily: 'monospace',
                        fontSize: '0.7rem'
                      }}
                    >
                      {formatSec(result.sec)}
                    </Typography>
                    <Typography
                      level='body-xs'
                      sx={{
                        color: 'neutral.400',
                        fontFamily: 'monospace',
                        fontSize: '0.7rem'
                      }}
                    >
                      #{result.gid + 1}
                    </Typography>
                  </Stack>
                  <Typography
                    level='body-md'
                    sx={{
                      color: 'neutral.500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {result.line}
                  </Typography>
                </Stack>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      {searchQuery && (!searchResults || searchResults.length === 0) && (
        <Typography
          level='body-sm'
          sx={{
            opacity: 0.6,
            textAlign: 'center',
            py: 2,
            mx: 1
          }}
        >
          No results found
        </Typography>
      )}
    </Stack>
  )
}
