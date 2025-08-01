import { useContext } from 'react'
import { Typography } from '@mui/joy'
import { ActionDrawer } from '../../../components/ActionDrawer.jsx'
import { ReaderCtx } from './ReaderCtx.jsx'

// Toolbar functions - state isolated via context
export const ToolbarFuncs = () => {
  const { actionDrawer, setActionDrawer } = useContext(ReaderCtx)

  const handleClose = () => {
    setActionDrawer({ ...actionDrawer, open: false })
  }

  return (
    <ActionDrawer
      open={actionDrawer.open}
      onClose={handleClose}
      size={actionDrawer.size}
    >
      <Typography>Word Tools Coming Soon</Typography>
    </ActionDrawer>
  )
}