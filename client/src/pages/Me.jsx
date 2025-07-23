import {
  Stack,
  Typography,
  Card,
  Button
} from '@mui/joy'
import { useAuth } from '../context/AuthContext'

export const Me = () => {
  const { user, logout } = useAuth()
  
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
        <Typography level="h3" mb={2} color="danger">🚪 Account</Typography>
        <Button onClick={logout} color="danger" variant="soft" fullWidth>
          Logout
        </Button>
      </Card>
    </Stack>
  )
} 