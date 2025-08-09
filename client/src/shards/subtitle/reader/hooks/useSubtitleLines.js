import { useEffect, useState, useRef } from 'react'
import { apiCall } from '../../../../config/api'
import { log } from '../../../../utils/logger'

// fetch all lines for a subtitle id (single shot)
export const useSubtitleLines = (id) => {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    setLines([])
    loadedRef.current = false
  }, [id])

  useEffect(() => {
    const load = async () => {
      if (!id || loadedRef.current) return
      setLoading(true)
      try {
        const data = await apiCall(`/api/subtitles/${id}/lines?start=0&count=-1`)
        const ls = data.lines || []
        log.debug(`📥 lines: ${ls.length}`)
        setLines(ls)
        loadedRef.current = true
      } catch (e) {
        log.error('lines load failed', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  return { lines, loading }
}


