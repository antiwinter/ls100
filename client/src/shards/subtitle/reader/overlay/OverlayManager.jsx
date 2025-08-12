import { useRef, useCallback, useEffect, useReducer } from 'react'
import { Box } from '@mui/joy'
import { Toolbar } from './Toolbar.jsx'
import { Dict } from './Dict.jsx'
import { FontDrawer } from './FontDrawer.jsx'
import { fontStack } from '../../../utils/font'

export const OverlayManager = ({
  title,
  languages,
  onSettingsChange,
  toolbar,
  explain,
  onBack
}) => {
  function reducer(state, action) {
    switch (action.type) {
      case 'TOGGLE_TOOL': {
        const same = state.action.open && state.action.tool === action.tool
        return { ...state, action: same ? { open: false, size: 'half', tool: null } : { open: true, size: 'half', tool: action.tool } }
      }
      case 'CLOSE_ACTION':
        return { ...state, action: { open: false, size: 'half', tool: null } }
      case 'SHOW_TOOLBAR':
        return { ...state, toolbar: true }
      case 'HIDE_TOOLBAR':
        return { ...state, toolbar: false }
      case 'OPEN_DICT':
        return { ...state, dict: { visible: true, word: action.word || '', position: action.position || 'bottom' } }
      case 'CLOSE_DICT':
        return { ...state, dict: { visible: false, word: '', position: 'bottom' } }
      case 'CLOSE_ALL':
        return { ...state, dict: { visible: false, word: '', position: 'bottom' }, action: { open: false, size: 'half', tool: null }, toolbar: false }
      case 'TOGGLE_LANG': {
        const next = new Map(state.langMap)
        const current = next.get(action.code)
        if (current) {
          next.set(action.code, { ...current, visible: !current.visible })
        }
        return { ...state, langMap: next }
      }
      case 'SET_LANGMAP':
        return { ...state, langMap: action.langMap || new Map() }
      case 'SET_FONT':
        return { 
          ...state, 
          font: { 
            ...state.font,
            mode: action.mode ?? state.font.mode,
            size: action.size ?? state.font.size
          } 
        }
      default:
        return state
    }
  }
  
  const [ui, dispatch] = useReducer(reducer, {
    dict: { visible: false, word: '', position: 'bottom' },
    action: { open: false, size: 'half', tool: null },
    toolbar: false,
    langMap: new Map(),
    font: { mode: 'sans', size: 16 }
  })

  useEffect(() => {
    if (Array.isArray(languages) && languages.length) {
      // Create langMap for ref languages (non-main)
      const langMap = new Map()
      languages.filter(l => !l.isMain).forEach(l => {
        langMap.set(l.code, { filename: l.filename, visible: true })
      })
      dispatch({ type: 'SET_LANGMAP', langMap })
      
      // Emit initial settings to parent
      onSettingsChange?.({
        fontSize: ui.font.size,
        fontFamily: fontStack(ui.font.mode),
        langMap
      })
    }
  }, [languages, onSettingsChange])

  // external control: toolbar and explain
  useEffect(() => {
    if (typeof toolbar === 'boolean') {
      toolbar ? dispatch({ type: 'SHOW_TOOLBAR' }) : dispatch({ type: 'HIDE_TOOLBAR' })
    }
  }, [toolbar])

  useEffect(() => {
    if (explain && explain.word) {
      // Calculate dict position based on y coordinate
      const position = explain.pos < window.innerHeight / 2 ? 'bottom' : 'top'
      dispatch({ type: 'OPEN_DICT', word: explain.word, position })
    } else {
      dispatch({ type: 'CLOSE_DICT' })
    }
  }, [explain])

  const handleToolSelect = (tool) => {
    dispatch({ type: 'TOGGLE_TOOL', tool })
    if (tool !== 'font') dispatch({ type: 'HIDE_TOOLBAR' })
  }

  // These handlers are now only UI-level; word actions handled in reader
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        visible={ui.toolbar}
        onBack={onBack}
        onToolSelect={handleToolSelect}
      />

      <Dict
        word={ui.dict.word}
        position={ui.dict.position}
        visible={ui.dict.visible}
        onClose={() => dispatch({ type: 'CLOSE_DICT' })}
      />

      <FontDrawer
        open={ui.action.open && ui.action.tool === 'font'}
        onClose={() => dispatch({ type: 'CLOSE_ACTION' })}
        settings={{ mode: ui.font.mode, size: ui.font.size }}
        onChangeFont={(font) => { 
          dispatch({ type: 'SET_FONT', ...font })
          const newFont = { ...ui.font, ...font }
          onSettingsChange?.({ 
            fontSize: newFont.size, 
            fontFamily: fontStack(newFont.mode) 
          })
        }}
        langMap={ui.langMap}
        onToggleLang={(code) => { 
          dispatch({ type: 'TOGGLE_LANG', code })
          // Get updated langMap after toggle
          const nextLangMap = new Map(ui.langMap)
          const current = nextLangMap.get(code)
          if (current) {
            nextLangMap.set(code, { ...current, visible: !current.visible })
          }
          // Only send langMap change
          onSettingsChange?.({ langMap: nextLangMap })
        }}
      />
    </Box>
  )
}

export default OverlayManager


