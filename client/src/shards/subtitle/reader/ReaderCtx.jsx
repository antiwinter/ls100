import { createContext, useState, useMemo } from 'react'

// Minimal context for drawer state isolation
export const ReaderCtx = createContext()

export const ReaderProvider = ({ children }) => {
  const [dictDrawer, setDictDrawer] = useState({ visible: false, word: '', position: 'bottom' })
  const [actionDrawer, setActionDrawer] = useState({ open: false, size: 'half' })

  // Stable context value - prevents unnecessary re-renders
  const value = useMemo(() => ({
    dictDrawer, 
    setDictDrawer, 
    actionDrawer, 
    setActionDrawer 
  }), [dictDrawer, actionDrawer])

  return (
    <ReaderCtx.Provider value={value}>
      {children}
    </ReaderCtx.Provider>
  )
}