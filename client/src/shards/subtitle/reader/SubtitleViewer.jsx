import { useEffect, useRef, useCallback, memo,
  useImperativeHandle, forwardRef } from 'react'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
dayjs.extend(duration)
import {
  Box,
  Stack,
  Typography
} from '@mui/joy'

// import { VirtualScroller as VS } from '../../../components/VirtualScroller.jsx'
import { VirtualScrollerRW as VS } from '../../../components/VirtualScrollerRWH.jsx'
import { useLongPress } from '../../../utils/useLongPress'
import { log } from '../../../utils/logger.js'

// Multi-language subtitle display - gets state from split contexts

const formatSec = s => {
  const d = dayjs.duration(s, 'seconds')
  return [d.hours(), d.minutes(), d.seconds()]
    .filter((v, i) => v !== 0 || i > 0)       // drop leading zero hours
    .map((v, i) => !i ? v : String(v).padStart(2, '0'))
    .join(':')
}

const SubtitleRow = memo(({ group, clean, renderMain }) => {
  const mainBucket = group.main
  const refMap = group.refs || new Map()
  // log.debug('VIEWER renderEntry', { sec: group.sec })
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
            flexShrink: 0,
            textAlign: 'right'
          }}
        >
          {formatSec(group.sec)}
        </Typography>
        <Stack spacing={0.25} sx={{ flex: 1 }}>
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
                    {renderMain(clean(entry.data?.text))}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {refMap && Array.from(refMap.entries()).map(([code, refEntries]) => {
            if (!refEntries.length) return null
            return (
              <Box key={code} data-ref-lang={code} style={{ display: 'none' }}>
                {refEntries.map((entry, i) => (
                  <Typography key={`r-${code}-${i}`} level="body-sm" sx={{ lineHeight: 1.3, color: 'neutral.700' }}>
                    {clean(entry.data?.text)}
                  </Typography>
                ))}
              </Box>
            )
          })}
        </Stack>
      </Stack>
    </Box>
  )
}, (prev, next) => (
  prev.group === next.group &&
  prev.clean === next.clean &&
  prev.renderMain === next.renderMain
))

const SubtitleViewer_ = forwardRef(({
  groups,
  seek,
  onWord,
  onEmptyClick,
  onGroupChange,
  onAnchored
}, ref) => {
  const viewerRef = useRef(null)
  const vsRef = useRef(null)
  const layoutProtect = useRef(0)

  // caches to re-apply on viewport changes
  const lastGidRef = useRef(-1)
  const wordlistRef = useRef(new Set())
  const langMapRef = useRef(null)
  const searchResultRef = useRef(new Set())

  log.debug('!!VIEWER re-render', { entries:groups?.length, entry0: groups?.[0], seek })

  const viewerInDOM = useCallback(ref => {
    log.debug('VIEWER viewerInDOM', { ref })
    if (!ref) return
    viewerRef.current = ref
    onAnchored?.(1)
  }, [onAnchored])

  const vsInDOM = useCallback(ref => {
    log.debug('VIEWER vsInDOM', { ref })
    if (!ref) return
    vsRef.current = ref
    ref.seek(seek, true)
  }, [seek])

  // DOM applicators
  const applyWordlist = useCallback(() => {
    // log.debug('VIEWER applyWordlist', { wordlistRef: wordlistRef.current })
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
    // log.debug('VIEWER applyLangMap', { langMapRef: langMapRef.current })
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

  const applySearchResults = useCallback(() => {
    const root = viewerRef.current
    if (!root) return
    const set = searchResultRef.current || new Set()

    // Single pass: clear or set highlight based on membership
    const allGroups = root.querySelectorAll('[data-index]')
    allGroups.forEach(el => {
      const gid = Number(el.getAttribute('data-index'))
      el.style.backgroundColor = set.has(gid) ? 'rgba(255, 235, 59, 0.3)' : ''
    })
  }, [])

  useImperativeHandle(ref, () => ({
    setWordlist: (words) => {
      // log.debug('viewer setWordlist', { count: Array.isArray(words)
      //   ? words.length : (words?.size || 0) })
      const set = words instanceof Set ? words : new Set(words || [])
      wordlistRef.current = set
      applyWordlist()
    },
    setLangMap: (langMap) => {
      const anchor = lastGidRef.current
      langMapRef.current = langMap || null
      log.debug('viewer setLangMap', { keys: langMap instanceof Map ? Array.from(langMap.keys()) : Object.keys(langMap || {}) })
      applyLangMap()
      vsRef.current?.seek(anchor, true)
      layoutProtect.current = 2
    },
    setFont: (font) => {
      const anchor = lastGidRef.current
      if (!viewerRef.current || !font) return
      const { fontFamily, fontSize } = font
      if (fontFamily) viewerRef.current.style.setProperty('--reader-font-family', fontFamily)
      if (Number.isFinite(fontSize)) viewerRef.current.style.setProperty('--reader-font-size', `${fontSize}px`)
      log.debug('viewer setFont', { font })
      vsRef.current?.seek(anchor, true)
      layoutProtect.current = 2
    },
    seek: (gid) => {
      log.debug('viewer seek', { gid })
      layoutProtect.current = 2
      vsRef.current?.seek(gid)
    },
    setSearchResult: (gids) => {
      const set = gids instanceof Set ? gids : new Set(gids || [])
      searchResultRef.current = set
      applySearchResults()
    }
  }))

  // Handle top item changes from intersection observer
  const handleRangeChange = useCallback(({ startId, stopId: _, end: __ }) => {
    // log.debug('viewer topItemChange', { id })
    applyWordlist()
    applyLangMap()
    applySearchResults()
    if (startId !== lastGidRef.current && layoutProtect.current < 1)
      onGroupChange?.(startId || 0)
    lastGidRef.current = startId
    layoutProtect.current--
  }, [applyWordlist, applyLangMap, applySearchResults, onGroupChange])

  const handleAnchored = useCallback(() => {
    log.debug('viewer handleAnchored', {  })
    onAnchored?.(2)
  }, [onAnchored])

  // Short/Long press helpers
  const getPressData = useCallback((e) => {
    const { word } = e.target?.dataset || {}
    if (!word || word.length <= 1) return null

    // Find parent with data-index to get group index
    const indexEl = e.target.closest('[data-index]')
    const gid = indexEl ? parseInt(indexEl.dataset.index) : undefined

    return { word, gid }
  }, [])

  const getClickY = (e) => {
    return e.clientY || (e.touches && e.touches[0]?.clientY)
    || (e.changedTouches && e.changedTouches[0]?.clientY) || window.innerHeight / 2
  }

  // Unified press handler
  const handlePress = useCallback((e, type) => {
    const data = getPressData(e)
    if (!data && type === 'short') { onEmptyClick?.(); return }
    e.stopPropagation()
    onWord?.(data.word, type === 'long' ? 'long' : 'short', getClickY(e), data.gid)
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

  const renderItem = useCallback(({ index }) => {
    const group = groups?.[index]
    if (!group) return null
    return (
      <Box data-index={index}>
        <SubtitleRow group={group} clean={cleanSrtText} renderMain={renderMain} />
      </Box>
    )
  }, [groups, cleanSrtText, renderMain])

  return (
    <Box
      ref={viewerInDOM}
      {...handlers}
      className="subtitle-viewer"
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        px: 1,
        py: 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        // Viewer scroll/pan is handled inside VirtualScrollerRW
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
      <VS
        ref={vsInDOM}
        name="subtitle-viewer"
        totalCount={groups?.length || 0}
        overscan={50}
        item={renderItem}
        onRangeChange={handleRangeChange}
        onAnchored={handleAnchored}
      />
    </Box>
  )
})

export const SubtitleViewer = memo(SubtitleViewer_)


