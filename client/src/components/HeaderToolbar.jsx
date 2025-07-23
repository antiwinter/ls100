import {
  Box,
  Typography,
  Button,
  Stack
} from '@mui/joy'
import { Add } from '@mui/icons-material'

export const HeaderToolbar = ({ title, onImport }) => {
  return (
    <Box sx={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      bgcolor: 'background.body',
      borderBottom: 1,
      borderColor: 'divider',
      p: 2
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography level="h2">{title}</Typography>
        <Button
          startDecorator={<Add />}
          onClick={onImport}
          size="sm"
        >
          Import
        </Button>
      </Stack>
    </Box>
  )
} 