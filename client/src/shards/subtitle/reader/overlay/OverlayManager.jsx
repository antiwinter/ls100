import { useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { Dict } from './Dict.jsx'
import { FontDrawer } from './FontDrawer.jsx'
import { log } from '../../../../utils/logger'

export const OverlayManager = forwardRef(({ onBack /*, sessionStore */
}, ref) => {
  // UI State
  const [xState, setXState] = useState({
    toolbar: false,
    tool: null,
    word: '',
    position: 'bottom'
  })

  const toggleTool = useCallback((tool) => {
    setXState(x => ({ ...x, tool: x.tool === tool ? null : tool }))
  }, [])

  const cleanDict = useCallback(() => {
    setXState(x => ({ ...x, tool: null }))
  }, [])

  useImperativeHandle(ref, () => ({
    toggleToolbar: () => {
      setXState(x => (x.tool || x.toolbar
        ? { ...x, toolbar: false, tool: null }
        : { ...x, toolbar: true }))
    },

    openDict: (word, position) => {
      log.info('OverlayManager:openDict received', { word, position })
      if (!word || typeof word !== 'string') return
      setXState(x => (x.tool === 'dict'
        ? { ...x, toolbar: false, word } // don't change position
        : { ...x, tool: 'dict', toolbar: false, word, position }))
    },

    // close tool
    closeTool: (clean = false) => {
      log.info('OverlayManager:closeTool called', { clean })
      setXState(x => ({ ...x, tool: x.tool === 'dict' ? 'dict' : null, toolbar: clean ? false : x.toolbar }))
    }
  }))



  return (
    <Box>
      <Toolbar
        visible={xState.toolbar}
        onBack={onBack}
        onToolSelect={toggleTool}
      />

      <Dict
        word={xState.word}
        position={xState.position}
        visible={xState.tool == 'dict'}
        onClose={cleanDict}
      />

      {/* <FontDrawer
        open={xState.tool === 'font'}
        sessionStore={sessionStore}
      /> */}
    </Box>
  )
})

export default OverlayManager
