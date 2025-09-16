export const formatCoverText = (title) => {
  if (!title) return { lines: [] }
  const words = title.toUpperCase().split(' ').filter(word => word.length > 0)
  if (words.length === 0) return { lines: [] }

  if (words.length === 1) {
    const w = words[0]
    const size = w.length > 12 ? 'small' : w.length > 8 ? 'medium' : 'large'
    return { lines: [{ text: w, size }] }
  }
  if (words.length === 2) return { lines: [
    { text: words[0], size: 'large' },
    { text: words[1], size: 'large' }
  ] }

  const lines = []
  let currentLine = []
  for (const word of words) {
    if (word.length > 8) {
      if (currentLine.length > 0) {
        lines.push({ text: currentLine.join(' '), size: 'medium' })
        currentLine = []
      }
      lines.push({ text: word, size: 'small' })
    } else {
      currentLine.push(word)
      if (currentLine.length === 2 || currentLine.join(' ').length > 12) {
        lines.push({ text: currentLine.join(' '), size: currentLine.length === 1 ? 'large' : 'medium' })
        currentLine = []
      }
    }
  }
  if (currentLine.length > 0) lines.push({ text: currentLine.join(' '), size: 'medium' })
  return { lines }
}

export const pickTextColorForBackground = (background) => {
  const colorMatch = background.match(/#([a-f\d]{6})/gi)
  if (!colorMatch) return '#ffffff'
  const hex = colorMatch[0].replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 140 ? '#000000' : '#ffffff'
}


