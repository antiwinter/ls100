import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { Dict } from './Dict.jsx'
import { FontDrawer } from './FontDrawer.jsx'
import { useOverlayUI } from './useUiState.jsx'

export const OverlayManager = ({ onBack }) => {
  const {
    xState,
    openTool,
    closeAll,
    closeTool
  } = useOverlayUI()

  return (
    <Box>
      <Toolbar
        visible={xState.toolbar}
        onBack={onBack}
        onToolSelect={openTool}
      />

      <Dict
        word={xState.word}
        position={xState.position}
        visible={xState.tool == 'dict'}
        onClose={closeAll}
      />

      <FontDrawer
        open={xState.tool === 'font'}
        onClose={closeTool}
      />
    </Box>
  )
}

export default OverlayManager
