import { Link } from 'react-router-dom'
import { 
  Box, 
  Container, 
  Typography, 
  Button,
  Stack
} from '@mui/joy'

function Home() {
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
        <Stack spacing={4} alignItems="center" textAlign="center">
          <Box>
            <Typography level="h1">
              LS100
            </Typography>
            <Typography level="title-lg">
              Full Stack React Application
            </Typography>
            <Typography level="body-lg">
              Modern web application built with React, Express.js, and Joy UI. 
              Clean architecture, beautiful design, production-ready.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button 
              component={Link}
              to="/demo"
              variant="solid" 
              size="lg"
            >
              View Demo
            </Button>
            <Button 
              variant="outlined" 
              size="lg"
              color="primary"
            >
              Learn More
            </Button>
          </Stack>

          <Typography level="body-sm">
            React • Express.js • Joy UI • Vite
          </Typography>
        </Stack>
      </Container>
    </Box>
  )
}

export default Home 