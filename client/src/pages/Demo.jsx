import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Box, 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  CircularProgress,
  Alert,
  Stack,
  Chip
} from '@mui/joy'

function Demo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // In production, API is on same origin. In dev, use localhost:3001
    const apiUrl = import.meta.env.PROD 
      ? '/api/hello' 
      : 'http://localhost:3001/api/hello';
      
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

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
        <Stack spacing={2} alignItems="center">
          <CircularProgress size="lg" />
          <Typography level="body-lg">Loading...</Typography>
        </Stack>
      </Box>
    )
  }

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Container maxWidth="sm">
          <Alert color="danger">
            <Typography level="title-md">Error: {error}</Typography>
          </Alert>
        </Container>
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
      <Container maxWidth="md">
        <Stack spacing={4} alignItems="center">
          <Button 
            component={Link}
            to="/"
            variant="outlined"
          >
            ← Back to Home
          </Button>

          <Box textAlign="center">
            <Typography level="h1">
              Backend Demo
            </Typography>
            <Typography level="title-lg">
              Testing full-stack connection
            </Typography>
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={3}>
                <Box textAlign="center">
                  <Typography level="h3">
                    Backend Connection
                  </Typography>
                  <Typography level="body-md">
                    Live data from Express.js server
                  </Typography>
                </Box>

                <Stack spacing={2}>
                  <Box>
                    <Typography level="body-sm">Message</Typography>
                    <Typography level="title-md">{data?.message}</Typography>
                  </Box>

                  <Box>
                    <Typography level="body-sm">Server & Environment</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip variant="soft">{data?.server}</Chip>
                      <Chip variant="soft" color={data?.env === 'production' ? 'success' : 'warning'}>
                        {data?.env}
                      </Chip>
                      <Chip variant="soft">Port: {data?.port}</Chip>
                    </Stack>
                  </Box>

                  <Box>
                    <Typography level="body-sm">Timestamp</Typography>
                    <Typography level="body-md">
                      {new Date(data?.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                </Stack>

                <Button 
                  variant="solid"
                  onClick={() => window.location.reload()}
                >
                  Refresh Data
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Typography level="body-sm">
            Built with React + Vite + Express.js + Joy UI
          </Typography>
        </Stack>
      </Container>
    </Box>
  )
}

export default Demo 