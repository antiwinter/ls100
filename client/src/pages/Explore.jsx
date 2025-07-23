import {
  Stack,
  Typography,
  Card,
  Button
} from '@mui/joy'

export const Explore = () => (
  <Stack spacing={3}>
    <Typography level="h1">Explore</Typography>
    <Card sx={{ p: 3 }}>
      <Typography level="h3" mb={2}>🎭 Popular Movies</Typography>
      <Typography>
        Discover popular movies and download their subtitles for learning.
      </Typography>
      <Button sx={{ mt: 2 }} disabled>
        Coming in Phase 5
      </Button>
    </Card>
    <Card sx={{ p: 3 }}>
      <Typography level="h3" mb={2}>📚 Vocabulary Lists</Typography>
      <Typography>
        Browse curated vocabulary lists from popular movies.
      </Typography>
      <Button sx={{ mt: 2 }} disabled>
        Coming Soon
      </Button>
    </Card>
  </Stack>
) 