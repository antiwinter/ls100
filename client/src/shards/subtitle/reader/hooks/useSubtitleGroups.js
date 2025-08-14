import { useEffect, useState, useRef, useMemo } from 'react'
import { apiCall } from '../../../../config/api'
import { log } from '../../../../utils/logger'

export function useSubtitleGroups(languages) {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  // Find main language internally
  const mainLanguage = languages?.find((l) => l.isMain) || languages?.[0]
  const mainLanguageCode = mainLanguage?.code

  // stable key to determine when to reload
  const key = useMemo(() => {
    if (!languages || !Array.isArray(languages)) return ''
    return languages
      .map((l) => `${l.subtitle_id || ''}:${l.code || ''}`)
      .join('|')
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
          const data = await apiCall(
            `/api/subtitles/${subtitle_id}/lines?start=0&count=-1`
          )
          const ls = data.lines || []
          return ls.map((line) => ({ ...line, language: code }))
        }
        const mainLines = await fetchOne(main)
        const refResults = await Promise.all(refs.map(fetchOne))
        const merged = mainLines.concat(...refResults)
        log.debug(
          `📥 lines(main+refs): ${merged.length} (main ${
            mainLines.length
          }, refs ${refResults.reduce((a, b) => a + b.length, 0)})`
        )
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
  // Group lines by timestamp
  const groups = useMemo(() => {
    const main = []
    const refs = []
    lines.forEach((line, idx) => {
      const code =
        line.language || line.data?.language || line.data?.lang || ''
      const startMs = line.data?.start || 0
      const item = { ...line, actualIndex: idx, startMs }
      if (code && mainLanguageCode && code === mainLanguageCode)
        main.push(item)
      else refs.push(item)
    })
    main.sort((a, b) => a.startMs - b.startMs)
    refs.sort((a, b) => a.startMs - b.startMs)
    const result = []
    let r = 0
    for (let i = 0; i < main.length; i++) {
      const m = main[i]
      const sec = Math.floor(m.startMs / 1000)
      const mainLines = [m]
      let j = i + 1
      while (j < main.length && Math.floor(main[j].startMs / 1000) === sec) {
        mainLines.push(main[j])
        j++
      }
      i = j - 1
      const refMap = new Map()
      while (r < refs.length && refs[r].startMs <= m.startMs) {
        const code =
          refs[r].language ||
          refs[r].data?.language ||
          refs[r].data?.lang ||
          'ref'
        if (!refMap.has(code)) refMap.set(code, [])
        refMap.get(code).push(refs[r])
        r++
      }
      result.push({ sec, main: mainLines, refs: refMap })
    }
    return result
  }, [lines, mainLanguageCode])

  const total = groups.length

  return { groups, total, loading }
}

export default useSubtitleGroups
