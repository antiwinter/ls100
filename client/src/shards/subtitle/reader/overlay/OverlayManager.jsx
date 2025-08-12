import { useRef, useCallback, useEffect, useReducer, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Box } from '@mui/joy'
import { Toolbar } from '../Toolbar.jsx'
import { Dict } from '../Dict.jsx'
import { FontDrawer } from '../FontDrawer.jsx'
import { SubtitleViewer } from '../SubtitleViewer.jsx'
import { fontStack } from '../../../utils/font'

export const OverlayManager = forwardRef(({
  title,
  languages,
  onSettingsChange,
  toolbar,
  explain,
  onBack
}, ref) => {
  const initialState = useMemo(() => ({
    dict: { visible: false, word: '', position: 'bottom' },
    action: { open: false, size: 'half', tool: null },
    toolbar: false,
    langSet: new Set(),
    font: { mode: 'sans', size: 16 }
  }), [])
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
        const next = new Set(state.langSet)
        next.has(action.code) ? next.delete(action.code) : next.add(action.code)
        return { ...state, langSet: next }
      }
      case 'SET_LANGSET':
        return { ...state, langSet: new Set(action.codes || []) }
      case 'SET_FONT_MODE':
        return { ...state, font: { ...state.font, mode: action.mode } }
      case 'SET_FONT_SIZE':
        return { ...state, font: { ...state.font, size: action.size } }
      default:
        return state
    }
  }
  const [ui, dispatch] = useReducer(reducer, undefined, () => initialState)
  const actions = useMemo(() => ({
    toggleTool: (tool) => dispatch({ type: 'TOGGLE_TOOL', tool }),
    closeAction: () => dispatch({ type: 'CLOSE_ACTION' }),
    showToolbar: () => dispatch({ type: 'SHOW_TOOLBAR' }),
    hideToolbar: () => dispatch({ type: 'HIDE_TOOLBAR' }),
    openDict: (word, position) => dispatch({ type: 'OPEN_DICT', word, position }),
    closeDict: () => dispatch({ type: 'CLOSE_DICT' }),
    closeAll: () => dispatch({ type: 'CLOSE_ALL' }),
    toggleLangLocal: (code) => dispatch({ type: 'TOGGLE_LANG', code }),
    setLangSet: (codes) => dispatch({ type: 'SET_LANGSET', codes })
  }), [])
  const viewerRef = useRef(null)
  
  useEffect(() => {
    if (Array.isArray(languages) && languages.length) {
      actions.setLangSet(languages.map(l => l.code))
    }
  }, [languages])

  // Expose imperative actions to reader (open dict, close all)
  useImperativeHandle(ref, () => ({
    openDict: (word, position) => actions.openDict(word, position),
    closeAll: () => actions.closeAll()
  }), [])

  const handleEmptyClick = useCallback(() => {
    if (ui.dict.visible || ui.action.open || ui.toolbar) {
      actions.closeAll()
      actions.hideToolbar()
    } else {
      actions.showToolbar()
    }
  }, [ui.dict.visible, ui.action.open, ui.toolbar, actions])

  // external control: toolbar and explain
  useEffect(() => {
    if (typeof toolbar === 'boolean') {
      toolbar ? actions.showToolbar() : actions.hideToolbar()
    }
  }, [toolbar])
  useEffect(() => {
    if (explain && typeof explain === 'string') {
      actions.openDict(explain, 'bottom')
    } else {
      actions.closeDict()
    }
  }, [explain])

  const handleToolSelect = (tool) => {
    actions.toggleTool(tool)
    if (tool !== 'font') actions.hideToolbar()
  }

  // These handlers are now only UI-level; word actions handled in reader

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        visible={ui.toolbar}
        onBack={onBack}
        onToolSelect={handleToolSelect}
        movieName={title}
      />

      {/* Viewer is rendered by reader; overlay only manages UI/drawers */}

      <Dict
        word={ui.dict.word}
        position={ui.dict.position}
        visible={ui.dict.visible}
        onClose={() => actions.closeDict()}
      />

      <FontDrawer
        open={ui.action.open && ui.action.tool === 'font'}
        onClose={() => actions.closeAction()}
        fontMode={ui.font.mode}
        onChangeFontMode={(mode) => { actions.setFontMode(mode); onSettingsChange?.({ fontMode: mode }) }}
        fontSize={ui.font.size}
        onChangeFontSize={(size) => { actions.setFontSize(size); onSettingsChange?.({ fontSize: size }) }}
        languages={languages}
        langSet={ui.langSet}
        mainLanguageCode={languages?.[0]?.code}
        onToggleLang={(code) => { actions.toggleLangLocal(code); onSettingsChange?.({ langSet: new Set(ui.langSet.has(code) ? [...ui.langSet].filter(c => c !== code) : [...ui.langSet, code]) }) }}
      />
    </Box>
  )
})

export default OverlayManager


