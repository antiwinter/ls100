import { useNavigate } from 'react-router-dom'
import {
  Box,
  Tabs,
  TabList,
  Tab,
  ListItemDecorator,
  tabClasses
} from '@mui/joy'
import {
  HomeRounded,
  Search,
  People,
  Person
} from '@mui/icons-material'

export const BottomNav = ({ activeTab }) => {
  const navigate = useNavigate()

  const handleTabChange = (event, value) => {
    switch (value) {
      case 0: navigate('/'); break
      case 1: navigate('/explore'); break
      case 2: navigate('/friends'); break
      case 3: navigate('/me'); break
    }
  }
  return (
    <Box sx={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      width: '100%',
      maxWidth: 400,
      px: 2
    }}>
      <Tabs
        size="lg"
        aria-label="Bottom Navigation"
        value={activeTab}
        onChange={handleTabChange}
        sx={(theme) => ({
          p: 1,
          borderRadius: 16,
          bgcolor: 'background.surface',
          boxShadow: theme.shadow.lg,
          [`& .${tabClasses.root}`]: {
            py: 1,
            flex: 1,
            transition: '0.3s',
            fontWeight: 'sm',
            fontSize: 'sm',
            color: 'text.tertiary',
            [`&:not(.${tabClasses.selected}):not(:hover)`]: {
              '& svg': {
                opacity: 0.6
              },
              '& > span:last-child': {
                opacity: 0.5
              }
            },
            [`&.${tabClasses.selected}`]: {
              color: 'primary.500',
              bgcolor: 'transparent',
              opacity: 1,
              fontWeight: 'md'
            },
          },
        })}
      >
        <TabList
          variant="plain"
          size="sm"
          disableUnderline
          sx={{ borderRadius: 'lg', p: 0 }}
        >
          <Tab
            disableIndicator
            orientation="vertical"
          >
            <ListItemDecorator>
              <HomeRounded sx={{ fontSize: 28, color: 'inherit' }} />
            </ListItemDecorator>
            Home
          </Tab>
          <Tab
            disableIndicator
            orientation="vertical"
          >
            <ListItemDecorator>
              <Search sx={{ fontSize: 28, color: 'inherit' }} />
            </ListItemDecorator>
            Explore
          </Tab>
          <Tab
            disableIndicator
            orientation="vertical"
          >
            <ListItemDecorator>
              <People sx={{ fontSize: 28, color: 'inherit' }} />
            </ListItemDecorator>
            Friends
          </Tab>
          <Tab
            disableIndicator
            orientation="vertical"
          >
            <ListItemDecorator>
              <Person sx={{ fontSize: 28, color: 'inherit' }} />
            </ListItemDecorator>
            Me
          </Tab>
        </TabList>
      </Tabs>
    </Box>
  )
} 