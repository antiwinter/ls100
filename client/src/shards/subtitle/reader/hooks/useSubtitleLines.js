import { useEffect, useState, useRef, useMemo } from 'react'
import { apiCall } from '../../../../config/api'
import { log } from '../../../../utils/logger'

// Fetch lines for all provided languages (main + refs) once
// languages: [{ subtitle_id, code }]
export const useSubtitleLines = (languages) => {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  // stable key to determine when to reload
  const key = useMemo(() => {
    if (!languages || !Array.isArray(languages)) return ''
    return languages.map(l => `${l.subtitle_id || ''}:${l.code || ''}`).join('|')
  }, [languages])

  useEffect(() => {
    setLines([])
    loadedRef.current = false
  }, [key])

  useEffect(() => {
    const load = async () => {
      if (!languages || !languages.length || loadedRef.current) return
      setLoading(true)
      try {
        // Fetch main first, then refs in parallel
        const [main, ...refs] = languages
        const fetchOne = async ({ subtitle_id, code }) => {
          if (!subtitle_id) return []
          const data = await apiCall(`/api/subtitles/${subtitle_id}/lines?start=0&count=-1`)
          const ls = data.lines || []
          return ls.map(line => ({ ...line, language: code }))
        }
        const mainLines = await fetchOne(main)
        const refResults = await Promise.all(refs.map(fetchOne))
        const merged = mainLines.concat(...refResults)
        log.debug(`📥 lines(main+refs): ${merged.length} (main ${mainLines.length}, refs ${refResults.reduce((a, b) => a + b.length, 0)})`)
        setLines(merged)
        loadedRef.current = true
      } catch (e) {
        log.error('lines load failed', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [languages, key])

  return { lines, loading }
}


