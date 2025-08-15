import { useEffect, useRef, useCallback, memo, useImperativeHandle, forwardRef } from 'react'
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
import { log } from '../../../utils/logger.js'

// Multi-language subtitle display - gets state from split contexts

const SubtitleViewer_ = forwardRef(({
  groups,
  position,
  onWord,
  onEmptyClick,
  onScroll,
  onCurrentGroupChange
}, ref) => {
  const viewerRef = useRef(null)
  const scrollerRef = useRef(null)

  // caches to re-apply on viewport changes
  const wordlistRef = useRef(new Set())
  const langMapRef = useRef(null)

  // DOM applicators
  const applyWordlist = useCallback(() => {
    const root = viewerRef.current
    if (!root) return
    const set = wordlistRef.current
    const nodes = root.querySelectorAll('span[data-word]')
    // log.warn('viewer applyWordlist', { nodes }, set, wordlistRef.current)
    nodes.forEach(el => {
      const w = el.getAttribute('data-word')
      if (!w) return
      if (set.has(w)) {
        // log.warn('viewer applyWordlist to w', { w })
        el.setAttribute('data-selected', 'true')
      }
      else el.removeAttribute('data-selected')
    })
  }, [])

  const applyLangMap = useCallback(() => {
    const root = viewerRef.current
    const lm = langMapRef.current
    if (!root || !lm) return
    const getVisible = (code) => {
      if (lm instanceof Map) return !!lm.get(code)?.visible
      const entry = lm[code]
      return !!(entry && entry.visible)
    }
    const blocks = root.querySelectorAll('[data-ref-lang]')
    blocks.forEach(el => {
      const code = el.getAttribute('data-ref-lang') || ''
      el.style.display = getVisible(code) ? '' : 'none'
    })
  }, [])

  useImperativeHandle(ref, () => ({
    setWordlist: (words) => {
      log.warn('viewer setWordlist', { words })
      const set = words instanceof Set ? words : new Set(words || [])
      wordlistRef.current = set
      applyWordlist()
    },
    setLangMap: (langMap) => {
      langMapRef.current = langMap || null
      applyLangMap()
    },
    setFont: (font) => {
      if (!viewerRef.current || !font) return
      const { fontFamily, fontSize } = font
      if (fontFamily) viewerRef.current.style.setProperty('--reader-font-family', fontFamily)
      if (Number.isFinite(fontSize)) viewerRef.current.style.setProperty('--reader-font-size', `${fontSize}px`)
    }
  }))

  // re-apply when the viewport changes (virtualized list)
  const onRangeChangeInternal = useCallback(({ startIndex }) => {
    applyWordlist()
    applyLangMap()
    onCurrentGroupChange?.(startIndex || 0)
  }, [applyWordlist, applyLangMap, onCurrentGroupChange])

  log.warn('VIEWER re-render', { entries:groups?.length })

  // Short/Long press helpers
  const getPressData = useCallback((e) => {
    const { word } = e.target?.dataset || {}
    if (!word || word.length <= 1) return null
    return { word }
  }, [])

  const getClickY = (e) => {
    return e.clientY || (e.touches && e.touches[0]?.clientY)
    || (e.changedTouches && e.changedTouches[0]?.clientY) || window.innerHeight / 2
  }

  // Unified press handler
  const handlePress = useCallback((e, type) => {
    const data = getPressData(e)
    if (!data) { onEmptyClick?.(); return }
    e.stopPropagation()
    onWord?.(data.word, type === 'long' ? 'long' : 'short', getClickY(e))
  }, [getPressData, onEmptyClick, onWord])

  const { handlers } = useLongPress(handlePress, { delay: 450 })

  // Clean SRT formatting tags - memoized for performance
  const cleanSrtText = useCallback((text) => {
    if (!text) return ''

    // Remove ASS/SSA formatting tags like {\an1}, {\pos(30,230)}, {\1c&Hffffff&}, etc.
    return text
      .replace(/\{\\[^}]*\}/g, '') // Remove {\tag} patterns
      .replace(/\{[^}]*\}/g, '')   // Remove other {tag} patterns
      .trim()
  }, [])

  // Render main language text with word overlays - memoized for performance
  const renderMain = useCallback((text) => {
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
  }, [])

  // Render complete entry with timestamp and all languages
  const renderEntry = (group) => {
    const mainBucket = group.main
    const refMap = group.refs || new Map()

    return (
      <Box sx={{ py: 0.1, mb: 1, backgroundColor: 'transparent', borderRadius: 'sm' }}>
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
            {dayjs(parseInt(group.sec) * 1000).utc().format('m:ss')}
          </Typography>
          <Stack spacing={0.25} sx={{ flex: 1 }}>
            {/* Main language - always show */}
            {mainBucket && mainBucket.length > 0 && (
              <Box data-lang="main">
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
                      {renderMain(cleanSrtText(entry.data?.text))}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            {/* Reference languages - visibility controlled by imperative API */}
            {refMap && Array.from(refMap.entries()).map(([code, refEntries]) => {
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
  }

  // Monitor position prop changes and scroll to index
  useEffect(() => {
    if (Number.isFinite(position)) {
      scrollerRef.current?.scrollToIndex(position, 'start')
    }
  }, [position])

  return (
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
        totalCount={groups?.length || 0}
        itemKey={(index) => `group${index}`}
        increaseViewportBy={{ top: 600, bottom: 1000 }}
        onRangeChange={onRangeChangeInternal}
        onScroll={(e) => {
          onScroll?.(e)
        }}
        itemContent={({ index }) => {
          const group = groups?.[index]
          if (!group) return null
          return (
            <Box data-group-index={index}>
              {renderEntry(group)}
            </Box>
          )
        }}
      />
    </Box>
  )
})

export const SubtitleViewer = memo(SubtitleViewer_)


