import { useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { Dict } from './Dict.jsx'
import { FontDrawer } from './FontDrawer.jsx'

export const OverlayManager = forwardRef(({ onBack, sessionStore }, ref) => {
  // UI State
  const [xState, setXState] = useState({
    toolbar: false,
    tool: null,
    word: '',
    position: 'bottom'
  })

  const _openTool = useCallback((tool) => {
    setXState(x => ({ ...x, tool }))
  }, [])

  useImperativeHandle(ref, () => ({
    openTool: (tool, word, position) => {
      setXState(x => ({ ...x, tool, toolbar: true, word, position }))
    },

    // don't close dict, don't close toolbar
    closeAll: () => {
      setXState(x => ({ ...x, tool: null, toolbar: false }))
    },

    // close tool
    closeTool: (clean = false) => {
      setXState(x => ({ ...x, tool: x.tool === 'dict' ? 'dict' : null,
        toolbar: clean ? false : x.toolbar }))    }
  }))



  return (
    <Box>
      <Toolbar
        visible={xState.toolbar}
        onBack={onBack}
        onToolSelect={_openTool}
      />

      <Dict
        word={xState.word}
        position={xState.position}
        visible={xState.tool == 'dict'}
      />

      <FontDrawer
        open={xState.tool === 'font'}
        sessionStore={sessionStore}
      />
    </Box>
  )
})

export default OverlayManager
