import { formatCoverText } from '../../utils/formatText.js'

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

  // Multi-color palettes for a more colorful star
  const colorSets = [
    ['#ff4d4d', '#ff9900', '#ffe53b'],
    ['#00eaff', '#0078ff', '#00ff87'],
    ['#ff00cc', '#ff6a00', '#ffe600'],
    ['#00f5d4', '#00bbf9', '#f15bb5'],
    ['#7c4dff', '#e040fb', '#ff1744'],
    ['#1de9b6', '#00e676', '#76ff03']
  ]
  const colors = colorSets[Math.abs(hash) % colorSets.length]
  const textColor = 'var(--joy-palette-neutral-100)'
  const gradientId = `ankiStarGrad-${Math.abs(hash)}`

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      textAlign: 'center',
      backgroundColor: 'var(--joy-palette-neutral-800)',
      color: textColor,
      padding: 8,
      lineHeight: 1,
      overflow: 'hidden'
    }}>
      {/* Big rotated colorful gradient star (under text) */}
      <svg
        width="100%"
        height="100%"
        viewBox="-10 -20 120 100"
        style={{ position: 'absolute', top: '0%', left: '10%',
          transform: 'rotate(-30deg)', opacity: 0.9, zIndex: 0,
          pointerEvents: 'none' }}
        aria-hidden
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((c, i) => (
              <stop key={i} offset={`${Math.round((i / (colors.length - 1)) * 100)}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <polygon
          points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39"
          fill={`url(#${gradientId})`}
          stroke={`url(#${gradientId})`}
          strokeLinejoin="round"
          strokeWidth="16"
        />
      </svg>
      <div style={{
        fontSize: 14,
        fontWeight: 900,
        fontFamily: 'Inter, Roboto, Arial Black, sans-serif',
        letterSpacing: 0.5,
        position: 'relative',
        zIndex: 1
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


