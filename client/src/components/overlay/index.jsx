import { useState, forwardRef, useImperativeHandle, useCallback, useRef, useEffect } from 'react'
import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { DictMainPageComponent, DictNotesPage, DictMorePage } from './Dict.jsx'
import { FontContent } from './Font.jsx'
import { ExportContent } from './Export.jsx'
import { WordListContent } from './Wordlist.jsx'
import { BookmarkContent } from './Bookmark.jsx'
import { ActionDrawer } from '../ActionDrawer.jsx'
// import { log } from '../../utils/logger.js'

export const OverlayManager = forwardRef(({ onBack, shardId = '' }, ref) => {
  // UI State
  const [xState, setXState] = useState({
    toolbar: false,
    tool: null,
    wordCtx: '',
    position: 'bottom',
    size: 'half'
  })

  const drawerRef = useRef(null)

  // toggle tool with toolbar open
  const toggleTool = useCallback((tool, position = 'bottom') => {
    setXState(x => ({ ...x, tool: x.tool === tool ? null : tool,
      position, size: tool === 'wordlist' ? 'fit-content' : 'half'
    }))
  }, [])

  const handleDrawerClose = useCallback(() => {
    setXState(x => ({ ...x, tool: null }))
  }, [])

  // Handle special dict features when dict opens
  useEffect(() => {
    if (xState.tool === 'dict' && xState.wordCtx) {
      // Small delay to ensure drawer is open
      setTimeout(() => {
        drawerRef.current?.snap(0)
        drawerRef.current?.resetScroll()
      }, 50)
    }
  }, [xState.tool, xState.wordCtx])

  useImperativeHandle(ref, () => ({
    toggleTools: (wordCtx, position) => {
      // if wordCtx -> open dict / update wordCtx
      // if tool or toolbar -> hide them all
      // else open toolbar
      setXState(x => {
        if (wordCtx && !x.toolbar) {
          x.size = 'half'
          return x.tool === 'dict' ? { ...x, wordCtx } :  { ...x, wordCtx, position, tool:'dict' }
        } else
          return { ...x, tool: null, toolbar: !(x.tool || x.toolbar) }
      })
    },
    closeTools: () => {
      setXState(x => ({ ...x, tool: null, toolbar: false }))
    }
  }))

  return (
    <Box>
      <Toolbar
        visible={xState.toolbar}
        onBack={onBack}
        onToolSelect={toggleTool}
      />

      <ActionDrawer
        ref={drawerRef}
        onClose={handleDrawerClose}
        position={xState.position}
        size={xState.size}
      >
        {/* dict */}
        {xState.tool === 'dict' && xState.wordCtx  && (
          <DictMainPageComponent key="main" word={xState.wordCtx.word} />)}
        {xState.tool === 'dict' && xState.wordCtx  && (<DictNotesPage key="notes" wordCtx={xState.wordCtx} />)}
        {xState.tool === 'dict' && xState.wordCtx  && (<DictMorePage key="more" />)}

        {xState.tool === 'font' && (<FontContent shardId={shardId} />)}
        {xState.tool === 'wordlist' && (<WordListContent shardId={shardId} />)}
        {xState.tool === 'export' && (<ExportContent shardId={shardId} />)}
        {xState.tool === 'bookmark' && (<BookmarkContent shardId={shardId} />)}
      </ActionDrawer>
    </Box>
  )
})

export default OverlayManager
