import { useState, forwardRef, useImperativeHandle, useCallback, useRef } from 'react'
import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { DictContent } from './Dict.jsx'
import { FontContent } from './FontDrawer.jsx'
import { ExportContent } from './ExportDrawer.jsx'
import { WordListContent } from './WordListDrawer.jsx'
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

  const toggleTool = useCallback((tool, position = 'bottom') => {
    setXState(x => ({ ...x, tool: x.tool === tool ? null : tool, position }))
  }, [])

  const handleDrawerClose = useCallback(() => {
    setXState(x => ({ ...x, tool: null }))
  }, [])

  useImperativeHandle(ref, () => ({
    toggleDict: (word, position) => {
      // if word -> open dict / update word
      // if tool or toolbar -> hide them all
      // else open toolbar
      setXState(x => {
        if (word && !x.toolbar) {
          return x.tool === 'dict' ? { ...x, word } :  { ...x, word, position, tool:'dict' }
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
        size="half"
      >
        {xState.tool === 'dict' && xState.word && (
          <DictContent word={xState.word} />
        )}
        {xState.tool === 'font' && (
          <FontContent sessionStore={sessionStore} />
        )}
        {xState.tool === 'wordlist' && (
          <WordListContent
            selectedWords={new Set(Array.isArray(wordlist) ? wordlist : Array.from(wordlist || []))}
            onWordDelete={(w) => {
              try {
                const api = sessionStore?.getState?.()
                if (api?.toggleWord) api.toggleWord(w)
              } catch (e) {
                log.error('Failed to toggle word from WordListDrawer', e)
              }
            }}
          />
        )}
        {xState.tool === 'export' && (
          <ExportContent
            selectedWords={Array.isArray(wordlist) ? wordlist : Array.from(wordlist || [])}
            movieName={movieName}
            shardId={shardId}
            currentLine={currentLine}
            lines={lines}
            onClose={handleDrawerClose}
          />
        )}
      </ActionDrawer>
    </Box>
  )
})

export default OverlayManager
