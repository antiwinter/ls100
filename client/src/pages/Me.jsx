import {
  Stack,
  Typography,
  Card,
  Button,
  Chip
} from '@mui/joy'
import { useAuth } from '../context/AuthContext'
import { APP } from '../config/constants'
import { useState } from 'react'

export const Me = () => {
  const { user, logout } = useAuth()
  const [/*noop*/, /*setNoop*/] = useState(null)
  
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
                v{APP.version}{APP.build && ` (${APP.build})`}
              </Chip>
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