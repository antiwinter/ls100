import {
  Box,
  Typography,
  Button,
  Stack,
  Select,
  Option
} from '@mui/joy'
import { AddCircleOutline, Sort, CheckCircleOutline } from '@mui/icons-material'

export const BrowserToolbar = ({
  title: _title, onImport, sortBy, onSortChange, onSelect, hasShards
}) => {
  return (
    <Box sx={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      bgcolor: 'background.body',
      py: 1,
      px: 2
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            startDecorator={<CheckCircleOutline />}
            onClick={onSelect}
            disabled={!hasShards}
            variant="plain"
            size="sm"
            sx={{
              fontSize: 'sm',
              fontWeight: 'normal',
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'transparent'
              },
              '&:active': {
                bgcolor: 'transparent'
              }
            }}
          >
            Select
          </Button>
          <Button
            startDecorator={<AddCircleOutline />}
            onClick={onImport}
            variant="plain"
            size="sm"
            sx={{
              fontSize: 'sm',
              fontWeight: 'normal',
              minHeight: 'auto',
              p: 0.5,
              '&:hover': {
                bgcolor: 'transparent'
              },
              '&:active': {
                bgcolor: 'transparent'
              }
            }}
          >
            Import
          </Button>
        </Stack>

        <Select
          value={sortBy}
          onChange={(e, value) => onSortChange(value)}
          variant="plain"
          size="sm"
          startDecorator={<Sort />}
          sx={{
            minWidth: 90,
            fontSize: 'xs',
            fontWeight: 'normal',
            minHeight: 'auto',
            borderRadius: 'xl'
          }}
        >
          <Option value="last_used">Last Used</Option>
          <Option value="name">Name</Option>
          <Option value="progress">Progress</Option>
        </Select>
      </Stack>
    </Box>
  )
}
