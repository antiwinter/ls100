import {
  Stack,
  Typography,
  Card,
  Button
} from '@mui/joy'

export const Friends = () => (
  <Stack spacing={3}>
    <Card sx={{ p: 3 }}>
      <Typography level="h3" mb={2}>Learning Together</Typography>
      <Typography>
        Connect with friends and share your learning progress.
      </Typography>
      <Button sx={{ mt: 2 }} disabled>
        Coming Soon
      </Button>
    </Card>
  </Stack>
)
