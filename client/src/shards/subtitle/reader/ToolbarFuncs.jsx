import { Typography } from '@mui/joy'
import { ActionDrawer } from '../../../components/ActionDrawer.jsx'

// Toolbar functions - no title shows floating close button
export const ToolbarFuncs = ({ open, size = 'half', onClose }) => {
  return (
    <ActionDrawer
      open={open}
      onClose={onClose}
      size={size}
      pages={[{ content: <Typography>Word Tools Coming Soon</Typography> }]}
    />
  )
}