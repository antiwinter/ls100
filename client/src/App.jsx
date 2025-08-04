import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { CssVarsProvider, Box, Typography, Button, Card, Tabs, TabPanel } from '@mui/joy'
import theme from './theme'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import { Home, EditShard, Explore, Friends, Me } from './pages'
import { BottomNav } from './components/BottomNav'
import { APP } from './config/constants'

const MainApp = () => {
  const [homeEditMode, setHomeEditMode] = useState(false)
  const [homeReaderMode, setHomeReaderMode] = useState(false)
  const location = useLocation()
  
  // Determine active tab based on current route
  const getActiveTab = () => {
    switch (location.pathname) {
      case '/': return 0
      case '/explore': return 1
      case '/friends': return 2
      case '/me': return 3
      default: return 0
    }
  }

  // Check if we should hide bottom nav (edit mode, reader mode, or on EditShard page)
  const shouldHideBottomNav = homeEditMode || homeReaderMode || location.pathname === '/edit-shard'

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
        pb: shouldHideBottomNav ? 0 : 10 // Space for bottom navigation when visible
      }}>
        <Routes>
          <Route path="/" element={<Home onEditModeChange={setHomeEditMode} onReaderModeChange={setHomeReaderMode} />} />
          <Route path="/edit-shard" element={<EditShard />} />
          <Route path="/explore" element={<Box sx={{ p: 2 }}><Explore /></Box>} />
          <Route path="/friends" element={<Box sx={{ p: 2 }}><Friends /></Box>} />
          <Route path="/me" element={<Box sx={{ p: 2 }}><Me /></Box>} />
        </Routes>
      </Box>

      {/* Bottom Navigation - hide when in edit mode or on EditShard page */}
      {!shouldHideBottomNav && (
        <BottomNav 
          activeTab={getActiveTab()}
        />
      )}
    </Box>
  )
}

const AuthFlow = () => {
  const [isLogin, setIsLogin] = useState(true)
  const { user, loading } = useAuth()



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
  // Set dynamic title from centralized config
  useEffect(() => {
    document.title = APP.name
    
    // Also update meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', APP.desc)
    }
  }, [])

  return (
    <CssVarsProvider 
      theme={theme}
      defaultMode="system"
              modeStorageKey={APP.storage.theme}
        colorSchemeStorageKey={APP.storage.colors}
    >
      <Router>
        <AuthProvider>
          <AuthFlow />
        </AuthProvider>
      </Router>
    </CssVarsProvider>
  )
}

export default App
