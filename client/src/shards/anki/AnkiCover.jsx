import { formatCoverText, pickTextColorForBackground } from '../../utils/formatText.js'

export const AnkiCover = ({ shard }) => {
  const metadata = shard?.metadata || {}

  let title = metadata.bundleName || shard?.name || 'Anki Shard'
  if (!metadata.bundleName && metadata.bundles?.length > 0) {
    title = metadata.bundles[0].name
  }

  let hash = 0
  const str = title
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }

  const gradients = [
    'linear-gradient(135deg, #3f51b5 0%, #1a237e 100%)',
    'linear-gradient(135deg, #2196f3 0%, #0d47a1 100%)',
    'linear-gradient(135deg, #009688 0%, #004d40 100%)',
    'linear-gradient(135deg, #4caf50 0%, #1b5e20 100%)',
    'linear-gradient(135deg, #ff9800 0%, #e65100 100%)'
  ]

  const background = gradients[Math.abs(hash) % gradients.length]
  const textColor = pickTextColorForBackground(background)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      textAlign: 'center',
      background,
      color: textColor,
      padding: 8,
      lineHeight: 1
    }}>
      <div style={{
        fontSize: 14,
        fontWeight: 900,
        fontFamily: 'Inter, Roboto, Arial Black, sans-serif',
        textShadow: '0 1px 2px rgba(0,0,0,0.7)',
        letterSpacing: 0.5
      }}>
        {(() => {
          const formatted = formatCoverText(title)
          if (formatted.lines.length === 0) return title?.toUpperCase()
          return formatted.lines.map((line, index) => (
            <div key={index} style={{
              fontSize: line.size === 'large' ? 16 : (line.size === 'medium' ? 13 : 11),
              fontWeight: 900,
              fontFamily: 'Inter, Roboto, Arial Black, sans-serif',
              lineHeight: 0.9,
              textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
              letterSpacing: 0.5,
              marginBottom: index < formatted.lines.length - 1 ? 3 : 0
            }}>
              {line.text}
            </div>
          ))
        })()}
      </div>
    </div>
  )
}


