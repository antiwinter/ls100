import { useState } from 'react'
import { Box, Card, Typography, Input, Button, Alert, Stack } from '@mui/joy'
import { useAuth } from '../../context/AuthContext'

const Login = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', p: 4 }}>
        <Typography level="h1" textAlign="center" mb={1}>
          Sign in to LS100
        </Typography>
        <Typography level="body-md" textAlign="center" mb={3} color="neutral">
          Learn English with movie subtitles
        </Typography>
        
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && (
              <Alert color="danger">
                {error}
              </Alert>
            )}
            
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              loading={loading}
              fullWidth
            >
              Sign in
            </Button>

            <Button
              variant="plain"
              onClick={onSwitchToRegister}
              fullWidth
            >
              Don't have an account? Sign up
            </Button>
          </Stack>
        </form>
      </Card>
    </Box>
  )
}

export default Login 