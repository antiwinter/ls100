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

  const formatTime = (sec) => {
    const minutes = Math.floor(sec / 60)
    const seconds = Math.floor(sec % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <Stack spacing={2} sx={{ px: 1, pb: 1 }}>
      <Typography level='title-sm'>Search</Typography>

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
      />

      {searchResults?.length > 0 && (
        <List size='sm' sx={{ maxHeight: '300px', overflow: 'auto' }}>
          {searchResults.map((result, idx) => (
            <ListItem key={idx}>
              <ListItemButton onClick={() => handleResultClick(result)}>
                <Stack spacing={0.5} sx={{ width: '100%' }}>
                  <Stack direction='row' justifyContent='space-between' alignItems='center'>
                    <Typography level='body-sm' sx={{ fontWeight: 500 }}>
                      {formatTime(result.sec)}
                    </Typography>
                    <Typography level='body-xs' sx={{ opacity: 0.7 }}>
                      #{result.gid + 1}
                    </Typography>
                  </Stack>
                  <Typography
                    level='body-sm'
                    sx={{
                      opacity: 0.8,
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
        <Typography level='body-sm' sx={{ opacity: 0.6, textAlign: 'center', py: 2 }}>
          No results found
        </Typography>
      )}
    </Stack>
  )
}
