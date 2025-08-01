import { useState } from 'react'
import { Box, Card, Typography, Input, Button, Alert, Stack } from '@mui/joy'
import { useAuth } from '../../context/AuthContext'
import { APP_CONFIG } from '../../config/app'

const Register = ({ onSwitchToLogin }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const { register } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      await register(name, email, password)
      setSuccess(true)
      setTimeout(() => {
        onSwitchToLogin()
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
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
          <Alert color="success">
            Registration successful! Redirecting to login...
          </Alert>
        </Card>
      </Box>
    )
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
          Create your account
        </Typography>
        <Typography level="body-md" textAlign="center" mb={3} color="neutral">
          Join {APP_CONFIG.name.short} and start learning
        </Typography>
        
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && (
              <Alert color="danger">
                {error}
              </Alert>
            )}
            
            <Input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />

            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            <Button
              type="submit"
              loading={loading}
              fullWidth
            >
              Create account
            </Button>

            <Button
              variant="plain"
              onClick={onSwitchToLogin}
              fullWidth
            >
              Already have an account? Sign in
            </Button>
          </Stack>
        </form>
      </Card>
    </Box>
  )
}

export default Register 