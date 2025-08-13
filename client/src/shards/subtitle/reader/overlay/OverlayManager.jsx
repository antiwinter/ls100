import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { Dict } from './Dict.jsx'
import { FontDrawer } from './FontDrawer.jsx'
import { useOverlayUI } from './useUiState.jsx'

export const OverlayManager = ({ onBack }) => {
  const { 
    toolbar, 
    dict, 
    actionDrawer,
    openTool,
    closeDict,
    closeTool
  } = useOverlayUI()

  return (
    <Box>
      <Toolbar
        visible={toolbar}
        onBack={onBack}
        onToolSelect={openTool}
      />

      <Dict
        word={dict.word}
        position={dict.position}
        visible={dict.visible}
        onClose={closeDict}
      />

      <FontDrawer
        open={actionDrawer.open && actionDrawer.tool === 'font'}
        onClose={closeTool}
      />
    </Box>
  )
}

export default OverlayManager