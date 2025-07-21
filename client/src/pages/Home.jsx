import { useState } from 'react'
import { 
  Box, 
  Tabs, 
  TabList, 
  Tab, 
  TabPanel,
  Typography,
  Button,
  Card,
  Stack,
  ListItemDecorator,
  tabClasses
} from '@mui/joy'
import {
  HomeRounded,
  Search,
  People,
  Person
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

// Tab content components
const HomeTab = () => {
  const { user } = useAuth()
  
  return (
    <Stack spacing={3}>
      <Typography level="h1">
        Welcome, {user.name}!
      </Typography>
      
      <Card sx={{ p: 3 }}>
        <Typography level="h2" mb={2}>
          🎬 Start Learning with Subtitles
        </Typography>
        <Typography mb={2}>
          Upload a movie subtitle file to begin your English learning journey.
        </Typography>
        <Button color="primary" size="lg" fullWidth>
          Upload Subtitle File
        </Button>
      </Card>

      <Card sx={{ p: 3 }}>
        <Typography level="h3" mb={2}>
          📊 Your Progress
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="h2" color="primary">0</Typography>
            <Typography level="body-sm">Words Learned</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="h2" color="success">0</Typography>
            <Typography level="body-sm">Movies Completed</Typography>
          </Box>
        </Box>
      </Card>
    </Stack>
  )
}

const ExploreTab = () => (
  <Stack spacing={3}>
    <Typography level="h1">Explore</Typography>
    <Card sx={{ p: 3 }}>
      <Typography level="h3" mb={2}>🎭 Popular Movies</Typography>
      <Typography>
        Discover popular movies and download their subtitles for learning.
      </Typography>
      <Button sx={{ mt: 2 }} disabled>
        Coming in Phase 5
      </Button>
    </Card>
    <Card sx={{ p: 3 }}>
      <Typography level="h3" mb={2}>📚 Vocabulary Lists</Typography>
      <Typography>
        Browse curated vocabulary lists from popular movies.
      </Typography>
      <Button sx={{ mt: 2 }} disabled>
        Coming Soon
      </Button>
    </Card>
  </Stack>
)

const FriendsTab = () => (
  <Stack spacing={3}>
    <Typography level="h1">Friends</Typography>
    <Card sx={{ p: 3 }}>
      <Typography level="h3" mb={2}>👥 Learning Together</Typography>
      <Typography>
        Connect with friends and share your learning progress.
      </Typography>
      <Button sx={{ mt: 2 }} disabled>
        Coming Soon
      </Button>
    </Card>
  </Stack>
)

const MeTab = () => {
  const { user, logout } = useAuth()
  
  return (
    <Stack spacing={3}>
      <Typography level="h1">Profile</Typography>
      <Card sx={{ p: 3 }}>
        <Typography level="h3" mb={2}>👤 {user.name}</Typography>
        <Typography level="body-sm" color="neutral" mb={2}>
          {user.email}
        </Typography>
        <Typography level="body-sm" color="neutral">
          Member since: {new Date(user.createdAt).toLocaleDateString()}
        </Typography>
      </Card>
      
      <Card sx={{ p: 3 }}>
        <Typography level="h3" mb={2}>⚙️ Settings</Typography>
        <Stack spacing={2}>
          <Button variant="outlined" fullWidth disabled>
            Language Preferences
          </Button>
          <Button variant="outlined" fullWidth disabled>
            Export Data
          </Button>
          <Button variant="outlined" fullWidth disabled>
            Account Settings
          </Button>
        </Stack>
      </Card>

      <Card sx={{ p: 3 }}>
        <Typography level="h3" mb={2} color="danger">🚪 Account</Typography>
        <Button onClick={logout} color="danger" variant="soft" fullWidth>
          Logout
        </Button>
      </Card>
    </Stack>
  )
}

const Home = () => {
  const [activeTab, setActiveTab] = useState(0)
  const colors = ['primary', 'success', 'warning', 'danger']

  return (
    <Box sx={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.body'
    }}>
      {/* Main content area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        pb: 10 // Space for bottom navigation
      }}>
        <Tabs 
          value={activeTab} 
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{ height: '100%' }}
        >
          {/* Content panels */}
          <TabPanel value={0} sx={{ p: 2 }}>
            <HomeTab />
          </TabPanel>
          <TabPanel value={1} sx={{ p: 2 }}>
            <ExploreTab />
          </TabPanel>
          <TabPanel value={2} sx={{ p: 2 }}>
            <FriendsTab />
          </TabPanel>
          <TabPanel value={3} sx={{ p: 2 }}>
            <MeTab />
          </TabPanel>

          {/* Elegant Bottom Navigation */}
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
              onChange={(event, value) => setActiveTab(value)}
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
        </Tabs>
      </Box>
    </Box>
  )
}

export default Home 