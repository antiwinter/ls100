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

  const toggleTool = useCallback((tool) => {
    setXState(x => ({ ...x, tool: x.tool === tool ? null : tool }))
  }, [])

  const handleDrawerClose = useCallback(() => {
    setXState(x => ({ ...x, tool: null }))
  }, [])

  useImperativeHandle(ref, () => ({
    toggleTools: (word, position) => {
      // if word -> open dict / update word
      // if tool or toolbar -> hide them all
      // else open toolbar
      setXState(x => {
        if (word) {
          if (x.tool === 'dict') return { ...x, word }
          else return { ...x, tool: 'dict', toolbar: false, word, position }
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
