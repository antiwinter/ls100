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

export const BottomNav = ({ activeTab, onTabChange }) => {
  const colors = ['primary', 'success', 'warning', 'danger']

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
        onChange={(event, value) => onTabChange(value)}
        sx={(theme) => ({
          p: 1,
          borderRadius: 16,
          bgcolor: 'background.surface',
          boxShadow: theme.shadow.lg,
          [`& .${tabClasses.root}`]: {
            py: 1,
            flex: 1,
            transition: '0.3s',
            fontWeight: 'md',
            fontSize: 'sm',
            [`&:not(.${tabClasses.selected}):not(:hover)`]: {
              opacity: 0.7,
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
            {...(activeTab === 0 && { color: colors[0] })}
          >
            <ListItemDecorator>
              <HomeRounded />
            </ListItemDecorator>
            Home
          </Tab>
          <Tab
            disableIndicator
            orientation="vertical"
            {...(activeTab === 1 && { color: colors[1] })}
          >
            <ListItemDecorator>
              <Search />
            </ListItemDecorator>
            Explore
          </Tab>
          <Tab
            disableIndicator
            orientation="vertical"
            {...(activeTab === 2 && { color: colors[2] })}
          >
            <ListItemDecorator>
              <People />
            </ListItemDecorator>
            Friends
          </Tab>
          <Tab
            disableIndicator
            orientation="vertical"
            {...(activeTab === 3 && { color: colors[3] })}
          >
            <ListItemDecorator>
              <Person />
            </ListItemDecorator>
            Me
          </Tab>
        </TabList>
      </Tabs>
    </Box>
  )
} 