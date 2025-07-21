import { useState } from 'react'
import { CssVarsProvider, Box, Typography, Button, Card } from '@mui/joy'
import theme from './theme'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import Home from './pages/Home'

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

  // Main app - redirect to Home component
  return <Home />
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
