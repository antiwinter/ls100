import { useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box } from '@mui/joy'
import { ArrowCounterClockwiseIcon, PencilSimpleLineIcon, CardsThreeIcon, InfoIcon } from '@phosphor-icons/react'
import { Toolbar } from '../utils/Toolbar.jsx'
import { ActionDrawer } from '../../../../components/ActionDrawer.jsx'
import { SessionDrawer } from './SessionDrawer.jsx'
import { EditDrawer } from './EditDrawer.jsx'
import { CardDrawer } from './CardDrawer.jsx'

export const StudyOverlay = ({ session, onAction, card }) => {
  const navigate = useNavigate()
  const [tool, setTool] = useState(null)
  const drawerRef = useRef(null)

  const actions = session(state => state.actions)
  const canUndo = (actions?.length || 0) > 0

  const buttons = useMemo(() => [
    { key: 'undo', title: 'Undo', Icon: () => <ArrowCounterClockwiseIcon size={20} />, disabled: !canUndo },
    { key: 'edit', title: 'Edit note', Icon: () => <PencilSimpleLineIcon size={20} /> },
    { key: 'session', title: 'Session', Icon: () => <CardsThreeIcon size={20} /> },
    { key: 'card', title: 'Card info', Icon: () => <InfoIcon size={20} /> }
  ], [canUndo])

  const handleSelect = useCallback((key) => {
    if (key === 'undo') {
      onAction?.('undo')
      return
    }
    setTool((prev) => prev === key ? null : key)
  }, [onAction])

  const handleClose = useCallback(() => {
    setTool(null)
  }, [])

  const handleCardSaved = useCallback((saved) => {
    if (saved) {
      onAction?.('card-saved')
    }
    setTool(null)
  }, [onAction])

  const handleToolAction = useCallback(async (actionType) => {
    await onAction?.(actionType)
    setTool(null)
  }, [onAction])

  const drawerSize = tool === 'edit' ? '85vh'
    : tool === 'session' ? '70vh'
      : tool === 'card' ? '60vh'
        : null

  return (
    <Box>
      <Toolbar
        visible
        border={false}
        buttons={buttons}
        activeKey={null}
        onSelect={handleSelect}
        onBack={() => navigate(-1)}
      />

      <ActionDrawer
        ref={drawerRef}
        size={drawerSize}
        position='bottom'
        onClose={handleClose}
      >
        {tool === 'edit' && <EditDrawer card={card} onSaved={handleCardSaved} />}
        {tool === 'session' && <SessionDrawer session={session} onAction={handleToolAction} onClose={handleClose} />}
        {tool === 'card' && <CardDrawer card={card} onAction={handleToolAction} onClose={handleClose} />}
      </ActionDrawer>
    </Box>
  )
}
