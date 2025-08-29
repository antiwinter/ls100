import {
  Stack,
  Typography,
  Card,
  Button,
  Chip
} from '@mui/joy'
import { Person, Settings, Info, ExitToApp } from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'
import { APP } from '../config/constants'
import { useState } from 'react'

export const Me = () => {
  const { user, logout } = useAuth()
  const [/*noop*/,] = useState(null)
  if (!user) return null
  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Person sx={{ fontSize: '2rem' }} />
          <Typography level="h3">{user.name}</Typography>
        </Stack>
        <Typography level="body-sm" color="neutral" mb={2}>
          {user.email}
        </Typography>
        <Typography level="body-sm" color="neutral">
          Member since: {new Date(user.created_at).toLocaleDateString()}
        </Typography>
      </Card>

      <Card sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Settings sx={{ fontSize: '2rem' }} />
          <Typography level="h3">Settings</Typography>
        </Stack>
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
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Info sx={{ fontSize: '2rem' }} />
          <Typography level="h3">App Information</Typography>
        </Stack>
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
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <ExitToApp sx={{ color: 'danger.500', fontSize: '2rem' }} />
          <Typography level="h3" color="danger">Account</Typography>
        </Stack>
        <Button onClick={logout} color="danger" variant="soft" fullWidth>
          Logout
        </Button>
      </Card>
    </Stack>
  )
}
