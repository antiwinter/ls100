import { useState } from 'react'
import { CssVarsProvider, Box, Typography, Button, Card } from '@mui/joy'
import theme from './theme'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/auth/Login'
import Register from './components/auth/Register'

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

  // Temporary main app placeholder
  return (
    <Box sx={{ minHeight: '100vh', p: 3 }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography level="h1">
            Welcome to LS100, {user.name}!
          </Typography>
          <Button onClick={logout} color="danger">
            Logout
          </Button>
        </Box>
        
        <Card sx={{ p: 3 }}>
          <Typography level="h2" mb={2}>
            Authentication Complete ✅
          </Typography>
          <Typography mb={2}>
            Phase 0.1 is working! Ready to implement Phase 0.2 (Main Layout).
          </Typography>
          <Box sx={{ bgcolor: 'background.level1', p: 2, borderRadius: 'sm' }}>
            <Typography level="body-sm" fontWeight="bold">User Info:</Typography>
            <Box component="pre" sx={{ mt: 1, fontSize: 'xs', overflow: 'auto' }}>
              {JSON.stringify(user, null, 2)}
            </Box>
          </Box>
        </Card>
      </Box>
    </Box>
  )
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
