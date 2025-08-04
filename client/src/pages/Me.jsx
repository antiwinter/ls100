import {
  Stack,
  Typography,
  Card,
  Button,
  Chip
} from '@mui/joy'
import { useAuth } from '../context/AuthContext'
import { APP } from '../config/constants'
import { useState, useEffect } from 'react'
import { apiCall } from '../config/api'

export const Me = () => {
  const { user, logout } = useAuth()
  const [backendVersion, setBackendVersion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBackendVersion = async () => {
      try {
        const data = await apiCall('/api/version')
        setBackendVersion(data)
      } catch (error) {
        console.warn('Failed to fetch backend version:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBackendVersion()
  }, [])
  
  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Typography level="h3" mb={2}>👤 {user.name}</Typography>
        <Typography level="body-sm" color="neutral" mb={2}>
          {user.email}
        </Typography>
        <Typography level="body-sm" color="neutral">
          Member since: {new Date(user.created_at).toLocaleDateString()}
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
        <Typography level="h3" mb={2}>ℹ️ App Information</Typography>
        <Stack spacing={2}>
          <Typography level="body-sm" color="neutral">
            <strong>{APP.name}</strong>
          </Typography>
          <Typography level="body-sm" color="neutral">
            {APP.desc}
          </Typography>
          
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="body-sm" color="neutral">Frontend:</Typography>
              <Chip size="sm" variant="soft" color="primary">
                v{APP.version}
              </Chip>
            </Stack>
            
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="body-sm" color="neutral">Backend:</Typography>
              {loading ? (
                <Chip size="sm" variant="soft" color="neutral">
                  Loading...
                </Chip>
              ) : backendVersion ? (
                <Chip size="sm" variant="soft" color="success">
                  v{backendVersion.version}
                </Chip>
              ) : (
                <Chip size="sm" variant="soft" color="warning">
                  Unknown
                </Chip>
              )}
            </Stack>
          </Stack>
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