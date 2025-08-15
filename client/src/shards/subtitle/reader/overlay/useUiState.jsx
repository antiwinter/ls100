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
    openDict(word, position)
  }, [openDict])

  const handleEmptyClick = useCallback(() => {
    // If any overlay is open, close them all; otherwise show toolbar
    setXState(x => {
      if (x.toolbar || x.tool) {
        return { ...x, tool:null, toolbar: false }
      }
      return { ...x, toolbar: true }
    })
  }, [])

  const handleScroll = useCallback(() => {
    setXState(x => {
      if (x.toolbar || x.tool) {
        return { ...x, tool:null, toolbar: false }
      }
      return x
    })
  }, [])

  const value = {
    // UI State
    xState,
    font,
    langMap,
    settings,

    // UI Actions
    setXState,
    openDict,
    openTool,
    closeTool,
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
