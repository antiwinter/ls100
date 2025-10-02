const COVER_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
]

import { formatCoverText, pickTextColorForBackground } from '../../utils/formatText.js'

export const SubtitleCover = ({ shard }) => {
  const title = shard?.meta?.languages?.[0]?.movie_name || shard?.name || 'SUBTITLE'

  let hash = 0
  const str = title || 'default'
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  const gradient = COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length]
  const textColor = pickTextColorForBackground(gradient)
  const formatted = formatCoverText(title)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      textAlign: 'center',
      background: gradient,
      color: textColor,
      padding: 8,
      lineHeight: 1
    }}>
      {formatted.lines.length > 0 ? formatted.lines.map((line, index) => (
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
      )) : (
        <div style={{
          fontSize: 14,
          fontWeight: 900,
          fontFamily: 'Inter, Roboto, Arial Black, sans-serif',
          textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
          letterSpacing: 0.5
        }}>
          {(title || 'SUBTITLE').toUpperCase()}
        </div>
      )}
    </div>
  )
}


