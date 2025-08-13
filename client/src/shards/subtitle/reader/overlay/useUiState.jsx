/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fontStack } from '../../../../utils/font'

const OverlayUIContext = createContext()

const useOverlayUI = () => {
  const context = useContext(OverlayUIContext)
  if (!context) {
    throw new Error('useOverlayUI must be used within OverlayUIProvider')
  }
  return context
}

export const OverlayUIProvider = ({ langMap: _langMap, children }) => {
  // UI State
  const [toolbar, setToolbar] = useState(false)
  const [dict, setDict] = useState({ 
    visible: false, 
    word: '', 
    position: 'bottom' 
  })
  const [actionDrawer, setActionDrawer] = useState({ 
    open: false, 
    tool: null 
  })
  
  // Settings State  
  const [font, setFont] = useState({ mode: 'sans', size: 16 })
  const [langMap, setLangMap] = useState(new Map())

  // Initialize/update langMap when _langMap changes (preserve visibility)
  useEffect(() => {
    if (_langMap && _langMap.size > 0) {
      setLangMap(prevLangMap => {
        const newLangMap = new Map()
        
        // Copy from _langMap, preserving visibility from previous state
        for (const [code, data] of _langMap.entries()) {
          const prevEntry = prevLangMap.get(code)
          newLangMap.set(code, {
            ...data,
            visible: prevEntry?.visible ?? true // Preserve previous visibility or default to true
          })
        }
        
        return newLangMap
      })
    }
  }, [_langMap])

  // Computed settings
  const settings = {
    fontSize: font.size,
    fontFamily: fontStack(font.mode),
    langMap
  }

  // UI Actions (stable identities)
  const openTool = useCallback((tool) => {
    setActionDrawer({ open: true, tool })
    if (tool !== 'font') setToolbar(false)
  }, [])

  const closeTool = useCallback(() => {
    setActionDrawer({ open: false, tool: null })
  }, [])

  const closeDict = useCallback(() => {
    setDict({ visible: false, word: '', position: 'bottom' })
  }, [])

  const closeAll = useCallback(() => {
    setToolbar(false)
    setDict({ visible: false, word: '', position: 'bottom' })
    setActionDrawer({ open: false, tool: null })
  }, [])

  const updateFont = useCallback((updates) => {
    setFont(prev => ({ ...prev, ...updates }))
  }, [])

  const toggleLang = useCallback((code) => {
    setLangMap(prev => {
      const next = new Map(prev)
      const current = next.get(code)
      if (current) {
        next.set(code, { ...current, visible: !current.visible })
      }
      return next
    })
  }, [])

  // UI Event Handlers (stable identities)
  const handleWordShort = useCallback((word, pos) => {
    const position = pos < window.innerHeight / 2 ? 'bottom' : 'top'
    setDict({ visible: true, word, position })
    setToolbar(false)
  }, [])

  const handleEmptyClick = useCallback(() => {
    // If any overlay is open, close them all; otherwise show toolbar
    const hasAnyOverlay = toolbar || dict.visible || actionDrawer.open
    
    if (hasAnyOverlay) {
      // Close all overlays
      setDict({ visible: false, word: '', position: 'bottom' })
      setActionDrawer({ open: false, tool: null })
      setToolbar(false)
    } else {
      // No overlays open, show toolbar
      setToolbar(true)
    }
  }, [toolbar, dict.visible, actionDrawer.open])

  const handleScroll = useCallback(() => {
    setToolbar(false)
    setActionDrawer({ open: false, tool: null })
  }, [])

  const value = {
    // UI State
    toolbar,
    dict,
    actionDrawer,
    font,
    langMap,
    settings,
    
    // UI Actions
    setToolbar,
    openTool,
    closeTool,
    closeDict,
    closeAll,
    updateFont,
    toggleLang,
    
    // UI Event Handlers
    handleWordShort,
    handleEmptyClick,
    handleScroll
  }

  return (
    <OverlayUIContext.Provider value={value}>
      {children}
    </OverlayUIContext.Provider>
  )
}

export { useOverlayUI }
