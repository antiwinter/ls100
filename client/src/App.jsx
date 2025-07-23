import { useState } from 'react'
import { CssVarsProvider, Box, Typography, Button, Card, Tabs, TabPanel } from '@mui/joy'
import theme from './theme'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import { Home } from './pages/Home'
import { Explore } from './pages/Explore'
import { Friends } from './pages/Friends'
import { Me } from './pages/Me'
import { BottomNav } from './components/BottomNav'

const MainApp = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [homeEditMode, setHomeEditMode] = useState(false)

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
        pb: homeEditMode ? 0 : 10 // Space for bottom navigation when not in edit mode
      }}>
        <Tabs 
          value={activeTab} 
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{ height: '100%' }}
        >
          {/* Content panels */}
          <TabPanel value={0} sx={{ p: 0 }}>
            <Home onEditModeChange={setHomeEditMode} />
          </TabPanel>
          <TabPanel value={1} sx={{ p: 2 }}>
            <Explore />
          </TabPanel>
          <TabPanel value={2} sx={{ p: 2 }}>
            <Friends />
          </TabPanel>
          <TabPanel value={3} sx={{ p: 2 }}>
            <Me />
          </TabPanel>
        </Tabs>
      </Box>

      {/* Bottom Navigation - hide when Home is in edit mode */}
      {!homeEditMode && (
        <BottomNav 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </Box>
  )
}

const AuthFlow = () => {
  const [isLogin, setIsLogin] = useState(true)
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography>Loading...</Typography>
      </Box>
    )
  }

  if (!user) {
    return isLogin ? (
      <Login onSwitchToRegister={() => setIsLogin(false)} />
    ) : (
      <Register onSwitchToLogin={() => setIsLogin(true)} />
    )
  }

  // Main app with tab navigation
  return <MainApp />
}

function App() {
  return (
    <CssVarsProvider 
      theme={theme}
      defaultMode="system"
      modeStorageKey="ls100-mode"
      colorSchemeStorageKey="ls100-color-scheme"
    >
      <AuthProvider>
        <AuthFlow />
      </AuthProvider>
    </CssVarsProvider>
  )
}

export default App
