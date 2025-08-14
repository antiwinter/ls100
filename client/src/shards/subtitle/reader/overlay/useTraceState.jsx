/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react'

const ReaderStateContext = createContext()

const useReaderState = () => {
  const context = useContext(ReaderStateContext)
  if (!context) {
    throw new Error('useReaderState must be used within ReaderStateProvider')
  }
  return context
}

export const ReaderStateProvider = ({ children }) => {
  // Content State
  const [position, setPosition] = useState({ current: 0, seek: null, total: 0 })
  const [selectedWords, setSelectedWords] = useState(new Set())

  // Position Actions (stable identities)
  const setPositionCurrent = useCallback((idx) => {
    setPosition(prev => ({ ...prev, current: idx }))
  }, [])

  const setSeek = useCallback((seekPos) => {
    setPosition(prev => ({ ...prev, seek: seekPos }))
  }, [])

  const setTotal = useCallback((total) => {
    setPosition(prev => ({ ...prev, total }))
  }, [])

  // Selected Words Actions (always new Set for immutability)
  const setSelectedWordsFromArray = useCallback((words) => {
    setSelectedWords(new Set(words || []))
  }, [])

  const toggleWord = useCallback((word) => {
    setSelectedWords(prev => {
      const next = new Set(prev)
      if (next.has(word)) {
        next.delete(word)
      } else {
        next.add(word)
      }
      return next
    })
  }, [])

  const clearSelectedWords = useCallback(() => {
    setSelectedWords(new Set())
  }, [])

  // Event Handlers (pre-wired with content state)
  const handleWordLong = useCallback((word) => {
    toggleWord(word)
  }, [toggleWord])

  const value = {
    // State
    position,
    selectedWords,

    // Position Actions
    setPositionCurrent,
    setSeek,
    setTotal,

    // Selected Words Actions
    setSelectedWordsFromArray,
    toggleWord,
    clearSelectedWords,

    // Event Handlers
    handleWordLong
  }

  return (
    <ReaderStateContext.Provider value={value}>
      {children}
    </ReaderStateContext.Provider>
  )
}

export { useReaderState }
