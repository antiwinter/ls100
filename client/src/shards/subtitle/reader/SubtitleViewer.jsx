import { useEffect, useRef, useMemo, memo, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Box,
  Stack,
  Typography
} from '@mui/joy'

import { InfiniteScroll } from '../../../components/InfiniteScroll'
import { useLongPress } from '../../../utils/useLongPress'

// Multi-language subtitle display - context-agnostic, stable
const SubtitleViewerComponent = ({ 
  lines,
  loading,
  onWordShort, // short press → container handles ensure-select + dict
  onWordLong,  // long press → container handles toggle only
  onEmptyClick,
  onScroll,
  onProgressUpdate,
  selectedWordsRef, // Add selectedWordsRef prop
  langSetRef, // Add langSetRef prop
  mainLanguageCode,
  languages
}, ref) => {
  const pendingIndexRef = useRef(null)
  const viewerRef = useRef(null)



  // Update word attributes based on current line and selected words
  const updateWordAttributes = useCallback((currentLineIndex) => {
    if (!selectedWordsRef?.current || !viewerRef.current) return
    
    const container = viewerRef.current
    const selectedWords = selectedWordsRef.current
    
    // Find all word spans in ±30 line range
    const startLine = Math.max(0, currentLineIndex - 30)
    const endLine = Math.min(lines.length - 1, currentLineIndex + 30)
    
    // Get all word spans in range
    const wordSpans = container.querySelectorAll('[data-word]')
    
    wordSpans.forEach(span => {
      const word = span.dataset.word
      const lineIndex = parseInt(span.closest('[data-line-index]')?.dataset.lineIndex || '0')
      
      // Only process spans in the current range
      if (lineIndex >= startLine && lineIndex <= endLine) {
        const isSelected = selectedWords.has(word)
        if (isSelected) {
          span.setAttribute('data-selected', 'true')
        } else {
          span.removeAttribute('data-selected')
        }
      }
    })
  }, [selectedWordsRef, lines.length])

  // Short/Long press helpers
  const getPressData = useCallback((e) => {
    const { word } = e.target?.dataset || {}
    if (!word || word.length <= 1) return null
    const span = e.target.closest('[data-word]')
    const lineIndex = parseInt(span?.closest('[data-line-index]')?.dataset.lineIndex || '0')
    return { word, lineIndex }
  }, [])

  const getDictPos = (e) => {
    const y = e.clientY || (e.touches && e.touches[0]?.clientY) || (e.changedTouches && e.changedTouches[0]?.clientY) || window.innerHeight / 2
    return y < window.innerHeight / 2 ? 'bottom' : 'top'
  }

  // Unified press handler
  const handlePress = useCallback((e, type) => {
    const data = getPressData(e)
    if (!data) { onEmptyClick?.(); return }
    e.stopPropagation()
    if (type === 'long') {
      onWordLong?.(data.word)
    } else {
      onWordShort?.(data.word, getDictPos(e))
    }
    updateWordAttributes(data.lineIndex)
  }, [getPressData, onEmptyClick, onWordLong, onWordShort, updateWordAttributes])

  const { handlers } = useLongPress(handlePress, { delay: 450 })

  // Imperative font style setter via CSS variables to avoid re-render
  const setFontStyle = useCallback(({ family, size }) => {
    if (!viewerRef.current) return
    if (family) viewerRef.current.style.setProperty('--reader-font-family', family)
    if (Number.isFinite(size)) viewerRef.current.style.setProperty('--reader-font-size', `${size}px`)
  }, [])
  


  // Render text with pre-rendered overlays (hidden by default)
  const renderText = (text) => {
    if (!text) return null
    
    return text.split(/(\s+)/).map((part, idx) => {
      if (/\s/.test(part)) return part
      
      const cleanWord = part.replace(/[^\w]/g, '').toLowerCase()
      
      return (
        <span
          key={idx}
          data-word={cleanWord}
          style={{
            cursor: 'pointer',
            position: 'relative',
            display: 'inline-block',
            lineHeight: 'inherit'
          }}
        >
          {part}
          {/* Pure overlay shade - shown via CSS when parent has data-selected */}
          <span
            className="word-overlay"
            style={{
              position: 'absolute',
              top: '-2px',
              left: '-2px',
              right: '-2px', 
              bottom: '-2px',
              borderRadius: '4px',
              backgroundColor: 'var(--joy-palette-primary-500)',
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none', // Don't interfere with clicks
              zIndex: 0 // Same level as text to show behind but visible
            }}
          />
        </span>
      )
    })
  }

  // Build groups from main language timeline and attach refs with ts <= main
  const entries = useMemo(() => {
    const main = []
    const refs = []
    lines.forEach((line, idx) => {
      const code = line.language || line.data?.language || line.data?.lang
      const startMs = (line.data && line.data.start) || 0
      const item = { ...line, actualIndex: idx, startMs }
      if (code && mainLanguageCode && code === mainLanguageCode) main.push(item)
      else refs.push(item)
    })
    main.sort((a, b) => a.startMs - b.startMs)
    refs.sort((a, b) => a.startMs - b.startMs)
    const result = []
    let r = 0
    for (let i = 0; i < main.length; i++) {
      const m = main[i]
      const sec = Math.floor(m.startMs / 1000)
      // main lines in same second
      const mainLines = [m]
      // collect subsequent mains in same second
      let j = i + 1
      while (j < main.length && Math.floor(main[j].startMs / 1000) === sec) {
        mainLines.push(main[j])
        j++
      }
      i = j - 1
      // collect refs with ts <= current main startMs
      const refMap = new Map()
      while (r < refs.length && refs[r].startMs <= m.startMs) {
        const code = refs[r].language || refs[r].data?.language || refs[r].data?.lang || 'ref'
        if (!refMap.has(code)) refMap.set(code, [])
        refMap.get(code).push(refs[r])
        r++
      }
      result.push([sec, { main: mainLines, refs: refMap }])
    }
    return result
  }, [lines, mainLanguageCode])

  // Update total groups when entries change
  useEffect(() => {
    if (entries.length > 0) {
      onProgressUpdate?.(1, entries.length) // Initialize with first group
    }
  }, [entries.length, onProgressUpdate])

  // 🎯 VIEWPORT CLIPPING: Master function that shows/hides groups and applies ALL styling
  const updateViewportGroups = useCallback((currentGroupIndex = 0, options = {}) => {
    if (!viewerRef.current || !entries || entries.length === 0) return
    
    const container = viewerRef.current
    const { font, langSet, selectedWords } = options
    
    // Define viewport range: ±30 groups around current
    const startGroup = Math.max(0, currentGroupIndex - 30)
    const endGroup = Math.min(entries.length - 1, currentGroupIndex + 30)
    
    // Debug: showing groups ${startGroup}-${endGroup} (${endGroup - startGroup + 1}/${entries.length})
    
    // Get all group elements
    const allGroups = container.querySelectorAll('[data-group-index]')
    let _visibleCount = 0
    let _hiddenCount = 0
    
    allGroups.forEach(element => {
      const groupIndex = parseInt(element.dataset.groupIndex || '0')
      const isInViewport = groupIndex >= startGroup && groupIndex <= endGroup
      
      if (isInViewport) {
        // SHOW group and apply ALL styling
        element.style.display = 'block'
        _visibleCount++
        
        // Apply font settings to this group
        if (font?.family) element.style.setProperty('--reader-font-family', font.family)
        if (font?.size) element.style.setProperty('--reader-font-size', `${font.size}px`)
        
        // Apply language visibility to ref elements in this group
        if (langSet) {
          const refElements = element.querySelectorAll('[data-ref-lang]')
          refElements.forEach(refEl => {
            const code = refEl.dataset.refLang
            if (code) {
              const visible = langSet.has(code)
              if (visible) {
                refEl.style.height = 'auto'
                refEl.style.margin = ''
                refEl.style.opacity = '1'
                refEl.style.overflow = ''
              } else {
                refEl.style.height = '0px'
                refEl.style.margin = '0'
                refEl.style.opacity = '0'
                refEl.style.overflow = 'hidden'
              }
            }
          })
        }
        
        // Apply word highlighting to this group
        if (selectedWords && selectedWords.size > 0) {
          const wordSpans = element.querySelectorAll('[data-word]')
          wordSpans.forEach(span => {
            const word = span.dataset.word
            if (word && selectedWords.has(word)) {
              span.classList.add('selected')
            } else {
              span.classList.remove('selected')
            }
          })
        }
        
      } else {
        // HIDE group completely
        element.style.display = 'none'
        _hiddenCount++
      }
    })
    
    // Debug: ${_visibleCount} visible, ${_hiddenCount} hidden groups
  }, [entries])

  // 🎯 INITIAL VIEWPORT CLIPPING: Show initial groups when entries are ready (after updateViewportGroups is defined)
  useEffect(() => {
    if (entries.length > 0) {
      updateViewportGroups(0, {
        selectedWords: selectedWordsRef?.current,
        langSet: langSetRef?.current 
      })
    }
  }, [entries.length, updateViewportGroups, selectedWordsRef, langSetRef])

  // Simplified font function - just triggers viewport update
  const applyFontToViewport = useCallback((fontOptions, currentGroupIndex = 0) => {
    updateViewportGroups(currentGroupIndex, { font: fontOptions })
  }, [updateViewportGroups])
  
  // Simplified language function - just triggers viewport update with updated langSet
  const applyLangVisibilityToViewport = useCallback((code, visible, currentGroupIndex = 0) => {
    // Create updated langSet for this change
    const updatedLangSet = new Set(langSetRef?.current || [])
    if (visible) {
      updatedLangSet.add(code)
    } else {
      updatedLangSet.delete(code)
    }
    
    updateViewportGroups(currentGroupIndex, { langSet: updatedLangSet })
  }, [updateViewportGroups, langSetRef])
  
  // Get current visible group for viewport targeting
  const getCurrentVisibleGroup = useCallback(() => {
    if (!viewerRef.current) return 0
    
    const container = viewerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerTop = containerRect.top
    
    // Find the first visible group element (data-group-index)
    const groupElements = container.querySelectorAll('[data-group-index]')
    
    for (const element of groupElements) {
      const rect = element.getBoundingClientRect()
      if (rect.bottom > containerTop + 50) { // 50px buffer
        const groupIndex = parseInt(element.dataset.groupIndex || '0')
        return groupIndex
      }
    }
    return 0
  }, [])

  // Imperative API: setPosition without emitting onScroll
  const tryScrollToIndex = useCallback((lineIndex) => {
    if (!viewerRef.current || !Number.isFinite(lineIndex)) return false
    const container = viewerRef.current
    const target = container.querySelector(`[data-line-index="${lineIndex}"]`)
    if (!target) return false
    target.scrollIntoView({ block: 'start' })
    updateWordAttributes(lineIndex)
    return true
  }, [updateWordAttributes])

  useImperativeHandle(ref, () => ({
    setPosition: (lineIndex) => {
      // Try now; if lines not ready, remember to apply later
      const applied = tryScrollToIndex(lineIndex)
      if (!applied) {
        pendingIndexRef.current = lineIndex
      } else {
        pendingIndexRef.current = null
      }
    },
    refreshSelection: (lineIndex = 0) => {
      updateWordAttributes(lineIndex)
    },
    setFontStyle,
    setRefLangVisibility: (_code, _visible) => {
      // No operations here - handled by parent to prevent performance issues
      return
    },
    // 🎯 VIEWPORT CLIPPING: All-in-one styling methods
    applyFontToViewport: (fontOptions) => {
      // Get current visible group for viewport targeting
      const currentGroupIndex = getCurrentVisibleGroup()
      applyFontToViewport(fontOptions, currentGroupIndex)
    },
    applyLangVisibilityToViewport: (code, visible) => {
      // Get current visible group for viewport targeting
      const currentGroupIndex = getCurrentVisibleGroup()
      applyLangVisibilityToViewport(code, visible, currentGroupIndex)
    },
    // Direct access to master viewport function
    updateViewportGroups: (options) => {
      const currentGroupIndex = getCurrentVisibleGroup()
      updateViewportGroups(currentGroupIndex, options)
    },
    // Expose DOM element for direct manipulation
    getDOMElement: () => viewerRef.current
  }), [tryScrollToIndex, updateWordAttributes, setFontStyle, applyFontToViewport, applyLangVisibilityToViewport, updateViewportGroups, getCurrentVisibleGroup])

  // When lines load or change, apply any pending scroll
  useEffect(() => {
    if (pendingIndexRef.current != null) {
      const applied = tryScrollToIndex(pendingIndexRef.current)
      if (applied) pendingIndexRef.current = null
    }
  }, [lines.length, tryScrollToIndex])

  return (
    <>
      {/* Dynamic CSS for ref language visibility - memoized */}
      <style>
        {useMemo(() => 
          languages
            .filter(lang => lang.code !== mainLanguageCode)
            .map(lang => `
              .ref-lang-${lang.code}-hidden [data-ref-lang="${lang.code}"] {
                height: 0px !important;
                margin: 0 !important;
                opacity: 0 !important;
                overflow: hidden !important;
              }
            `).join('\n')
        , [languages, mainLanguageCode])}
      </style>
      
      <Box
        ref={viewerRef}
        {...handlers}
        className="subtitle-viewer"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'pan-y',
          // CSS vars for dynamic font without re-render
          '--reader-font-family': 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Heiti SC, sans-serif',
          '--reader-font-size': '16px',
        '& *, & *::before, & *::after': {
          userSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none'
        },
        // CSS for word selection overlay
        '& .word-overlay': {
          opacity: 0 // Hidden by default
        },
        '& span[data-selected="true"] .word-overlay': {
          opacity: 0.3 // Show when selected
        }
      }}
    >
      <InfiniteScroll
        loading={loading}
        onScroll={(e, currentLine) => {
          // Convert line to group index for proper progress tracking
          const currentGroupIndex = getCurrentVisibleGroup()
          
          onScroll?.(e, currentLine)
          onProgressUpdate?.(currentGroupIndex + 1, entries.length) // Update progress with group info
          
          // 🎯 VIEWPORT CLIPPING: Update visible groups on scroll
          updateViewportGroups(currentGroupIndex, { 
            selectedWords: selectedWordsRef?.current,
            langSet: langSetRef?.current 
          })
          
          // Update word attributes when scrolling (now handled by viewport clipping)
          if (currentLine) {
            updateWordAttributes(currentLine - 1) // Convert to 0-based index
          }
        }}
      >
        {entries.map(([sec, group], groupIndex) => {
          // intentionally unused: isCurrent reserved for future highlight
          // const isCurrent = lines.some(line => line.actualIndex === visibleIndex)
          return (
            <Box
              key={sec}
              data-group-index={groupIndex}
              sx={{
                py: 0.1,
                mb: 1,
                backgroundColor: 'transparent',
                borderRadius: 'sm',
                display: 'none' // 🎯 VIEWPORT CLIPPING: Start hidden, viewport function will show/hide
              }}
            >
              {(() => {
                const mainBucket = group.main
                const refMap = group.refs || new Map()
                const otherCodes = (languages || []).map(l => l.code).filter(c => c && c !== mainLanguageCode)
                return (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Typography 
                      level="body-xs" 
                      color="neutral" 
                      sx={{ 
                        minWidth: '40px',
                        fontSize: '10px',
                        lineHeight: 1.2,
                        pt: 0.5,
                        flexShrink: 0
                      }}
                    >
                      {formatTime(parseInt(sec) * 1000)}
                    </Typography>
                    <Stack spacing={0.25} sx={{ flex: 1 }}>
                      {/* main language lines with tokenization */}
                      {mainBucket && mainBucket.length > 0 && (
                        <Box data-lang={mainLanguageCode}>
                          {mainBucket.map((line, i) => (
                            <Box key={`m-${i}`} data-line-index={line.actualIndex || 0}>
                              <Typography
                                level="body-sm"
                                sx={{
                                  lineHeight: 1.3,
                                  fontSize: 'var(--reader-font-size)',
                                  fontFamily: 'var(--reader-font-family)'
                                }}
                              >
                                {renderText(cleanSrtText(line.data?.text))}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* reference language blocks: unified style; visibility controlled via imperative API */}
                      {otherCodes.map(code => {
                        const refLines = refMap.get(code) || []
                        if (!refLines.length) return null
                        return (
                          <Box key={code} data-ref-lang={code}>
                            {refLines.map((line, i) => (
                              <Typography key={`r-${code}-${i}`} level="body-sm" sx={{ lineHeight: 1.3, color: 'neutral.700' }}>
                                {cleanSrtText(line.data?.text)}
                              </Typography>
                            ))}
                          </Box>
                        )
                      })}
                    </Stack>
                  </Stack>
                )
              })()}
            </Box>
          )
        })}
      </InfiniteScroll>
    </Box>
    </>
  )
}

// Clean SRT formatting tags like {\an1}, {\pos(30,230)}, etc.
const cleanSrtText = (text) => {
  if (!text) return ''
  
  // Remove ASS/SSA formatting tags like {\an1}, {\pos(30,230)}, {\1c&Hffffff&}, etc.
  return text
    .replace(/\{\\[^}]*\}/g, '') // Remove {\tag} patterns
    .replace(/\{[^}]*\}/g, '')   // Remove other {tag} patterns
    .trim()
}

// Format time from milliseconds to MM:SS
const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Get language info for display
// const getLanguageInfo = () => ({ code: 'en' }) // Simplified placeholder

// Memoize the component to prevent re-renders when unrelated state changes
export const SubtitleViewer = memo(forwardRef(SubtitleViewerComponent))