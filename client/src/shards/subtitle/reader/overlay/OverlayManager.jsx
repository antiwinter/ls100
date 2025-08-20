import { useState, forwardRef, useImperativeHandle, useCallback, useRef, useEffect } from 'react'
import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { getDictContent } from './Dict.jsx'
import { getFontDrawerContent } from './FontDrawer.jsx'
import { getExportDrawerContent } from './ExportDrawer.jsx'
import { getWordListDrawerContent } from './WordListDrawer.jsx'
import { ActionDrawer } from '../../../../components/ActionDrawer.jsx'
import { log } from '../../../../utils/logger'

export const OverlayManager = forwardRef(({ onBack, sessionStore, wordlist = [], movieName = '', shardId = '', currentLine = 0, lines = []
}, ref) => {
  // UI State
  const [xState, setXState] = useState({
    toolbar: false,
    tool: null,
    word: '',
    position: 'bottom'
  })

  const drawerRef = useRef(null)

  const toggleTool = useCallback((tool) => {
    setXState(x => ({ ...x, tool: x.tool === tool ? null : tool }))
  }, [])

  const handleDrawerClose = useCallback(() => {
    setXState(x => ({ ...x, tool: null }))
  }, [])

  // When the tool changes, open the drawer with the right content
  useEffect(() => {
    if (!xState.tool) {
      drawerRef.current?.close()
      return
    }

    let content = null

    switch (xState.tool) {
    case 'dict':
      content = getDictContent({
        word: xState.word,
        position: xState.position
      })
      break
    case 'font':
      content = getFontDrawerContent({ sessionStore })
      break
    case 'wordlist':
      content = getWordListDrawerContent({
        selectedWords: new Set(Array.isArray(wordlist) ? wordlist : Array.from(wordlist || [])),
        onWordDelete: (w) => {
          try {
            const api = sessionStore?.getState?.()
            if (api?.toggleWord) api.toggleWord(w)
          } catch (e) {
            log.error('Failed to toggle word from WordListDrawer', e)
          }
        }
      })
      break
    case 'export':
      content = getExportDrawerContent({
        selectedWords: Array.isArray(wordlist) ? wordlist : Array.from(wordlist || []),
        movieName,
        shardId,
        currentLine,
        lines,
        onClose: handleDrawerClose
      })
      break
    default:
      drawerRef.current?.close()
      return
    }

    if (content && drawerRef.current) {
      log.debug('Opening drawer with content:', { tool: xState.tool, title: content.title })
      drawerRef.current.open(content.pages)

      // Handle special cases for dict drawer
      if (xState.tool === 'dict') {
        drawerRef.current.snap?.(0)
        drawerRef.current.resetScroll?.()
      }
    }

  }, [
    xState.tool, xState.word, xState.position, sessionStore,
    wordlist, movieName, shardId, currentLine,
    lines, handleDrawerClose
  ])

  useImperativeHandle(ref, () => ({
    toggleTools: (word, position) => {
      // if word -> open dict / update word
      // if tool or toolbar -> hide them all
      // else open toolbar
      setXState(x => {
        if (word) {
          if (x.tool === 'dict') return { ...x, word }
          else return { ...x, word, position }
        } else  return { ...x, tool: null, toolbar: !(x.tool || x.toolbar) }
      })
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
        size="half"
      />
    </Box>
  )
})

export default OverlayManager
