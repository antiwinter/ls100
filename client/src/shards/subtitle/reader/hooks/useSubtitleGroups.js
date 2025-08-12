import { useMemo } from 'react'

export function useSubtitleGroups(lines, mainLanguageCode, languages) {
  const groups = useMemo(() => {
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
      const mainLines = [m]
      let j = i + 1
      while (j < main.length && Math.floor(main[j].startMs / 1000) === sec) {
        mainLines.push(main[j])
        j++
      }
      i = j - 1
      const refMap = new Map()
      while (r < refs.length && refs[r].startMs <= m.startMs) {
        const code = refs[r].language || refs[r].data?.language || refs[r].data?.lang || 'ref'
        if (!refMap.has(code)) refMap.set(code, [])
        refMap.get(code).push(refs[r])
        r++
      }
      result.push({ sec, main: mainLines, refs: refMap })
    }
    return result
  }, [lines, mainLanguageCode])

  const total = groups.length

  return { groups, total }
}

export default useSubtitleGroups


