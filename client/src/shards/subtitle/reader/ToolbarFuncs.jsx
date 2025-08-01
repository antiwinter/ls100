import { Typography } from '@mui/joy'
import { ActionDrawer } from '../../../components/ActionDrawer.jsx'

// Toolbar functions - simple props interface
export const ToolbarFuncs = ({ open, size = 'half', onClose }) => {
  return (
    <ActionDrawer
      open={open}
      onClose={onClose}
      size={size}
    >
      <Typography>Word Tools Coming Soon</Typography>
    </ActionDrawer>
  )
}