import { useEffect, useRef, useMemo, memo, useCallback } from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)
import {
  Box,
  Stack,
  Typography
} from '@mui/joy'

import VirtualScroller from '../../../components/VirtualScroller'
import { useLongPress } from '../../../utils/useLongPress'

// Multi-language subtitle display - context-agnostic, stable
const SubtitleViewerComponent = ({ 
  groups,
  selectedWords,
  settings,
  languages,
  position,
  onWord,
  onEmptyClick,
  onScroll,
  onCurrentGroupChange
}) => {
  const viewerRef = useRef(null)
  const scrollerRef = useRef(null)

  // Removed imperative DOM highlight updates; rely on render-time classes via selectedWords

  // Short/Long press helpers
  const getPressData = useCallback((e) => {
    const { word } = e.target?.dataset || {}
    if (!word || word.length <= 1) return null
    return { word }
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
    onWord?.(data.word, type === 'long' ? 'long' : 'short', getDictPos(e))
  }, [getPressData, onEmptyClick, onWord])

  const { handlers } = useLongPress(handlePress, { delay: 450 })

  // Apply font style via CSS variables when props change
  useEffect(() => {
    if (!viewerRef.current || !settings) return
    const { fontMode, fontSize } = settings
    const family = fontStack(fontMode)
    if (family) viewerRef.current.style.setProperty('--reader-font-family', family)
    if (Number.isFinite(fontSize)) viewerRef.current.style.setProperty('--reader-font-size', `${fontSize}px`)
  }, [settings])
  


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
          data-selected={selectedWords?.has?.(cleanWord) ? 'true' : undefined}
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

  // Use precomputed groups from hook in the reader
  const entries = useMemo(() => groups?.map(g => [g.sec, { main: g.main, refs: g.refs }]) || [], [groups])

  // Reader sets total groups based on groups; only report current index via range change

  // Virtuoso provides rangeChanged; no manual visibility querying needed

  useEffect(() => {
    if (Number.isFinite(position)) {
      scrollerRef.current?.scrollToIndex(position, 'start')
    }
  }, [position])

  // When entries change, apply any pending scroll (group-based)
  useEffect(() => {
    if (pendingIndexRef.current != null) {
      const gi = pendingIndexRef.current
      scrollerRef.current?.scrollToIndex(gi, 'start')
      pendingIndexRef.current = null
    }
  }, [entries.length])

  return (
    <>
      {/* No dynamic CSS injection needed; ref blocks render conditionally via langSet */}
      
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
          '--reader-font-family': 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Heiti SC, sans-serif',
          '--reader-font-size': '16px',
          '& *, & *::before, & *::after': {
            userSelect: 'none',
            WebkitUserSelect: 'none',
            msUserSelect: 'none'
          },
          '& .word-overlay': { opacity: 0 },
          '& span[data-selected="true"] .word-overlay': { opacity: 0.3 }
        }}
      >
        <VirtualScroller
          ref={scrollerRef}
          totalCount={entries.length}
          itemKey={(index) => entries[index]?.[0] ?? index}
          increaseViewportBy={{ top: 600, bottom: 1000 }}
          onRangeChange={({ startIndex }) => {
            const currentGroupIndex = startIndex || 0
            // Notify parent; position is group-based now
            onScroll?.(null, currentGroupIndex)
            // Notify controlled prop with 0-based index
            onCurrentGroupChange?.(currentGroupIndex)
          }}
          onScroll={(e) => {
            // For UI behaviors like toolbar/drawer hiding
            onScroll?.(e)
          }}
          itemContent={({ index }) => {
            const [sec, group] = entries[index]
            const mainBucket = group.main
            const refMap = group.refs || new Map()
            const otherCodes = (languages || []).map(l => l.code).filter(c => c && c !== mainLanguageCode)
            return (
              <Box
                data-group-index={index}
                sx={{
                  py: 0.1,
                  mb: 1,
                  backgroundColor: 'transparent',
                  borderRadius: 'sm'
                }}
              >
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
                    {mainBucket && mainBucket.length > 0 && (
                      <Box data-lang={mainLanguageCode}>
                        {mainBucket.map((entry, i) => (
                          <Box key={`m-${i}`}>
                            <Typography
                              level="body-sm"
                              sx={{
                                lineHeight: 1.3,
                                fontSize: 'var(--reader-font-size)',
                                fontFamily: 'var(--reader-font-family)'
                              }}
                            >
                              {renderText(cleanSrtText(entry.data?.text))}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                    {otherCodes.map(code => {
                      if (!langSet || !langSet.has || !langSet.has(code)) return null
                      const refEntries = refMap.get(code) || []
                      if (!refEntries.length) return null
                      return (
                        <Box key={code} data-ref-lang={code}>
                          {refEntries.map((entry, i) => (
                            <Typography key={`r-${code}-${i}`} level="body-sm" sx={{ lineHeight: 1.3, color: 'neutral.700' }}>
                              {cleanSrtText(entry.data?.text)}
                            </Typography>
                          ))}
                        </Box>
                      )
                    })}
                  </Stack>
                </Stack>
              </Box>
            )
          }}
        />
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
const formatTime = (ms) => dayjs(ms).utc().format('m:ss')

// Get language info for display
// const getLanguageInfo = () => ({ code: 'en' }) // Simplified placeholder

// Memoize the component to prevent re-renders when unrelated state changes
export const SubtitleViewer = memo(forwardRef(SubtitleViewerComponent))