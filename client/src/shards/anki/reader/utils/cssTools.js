// import { log } from '../../../../utils/logger.js'
import { detectPlatform } from '../../../../utils/useDetectPlatform.js'

// Scope Anki card CSS to prevent global style pollution
export function scopeCSS(css, scopeClass = '.anki-card') {
  if (!css) return ''

  // Step 1: Remove all CSS comments
  let processed = css.replace(/\/\*[\s\S]*?\*\//g, '')

  // Step 2: Extract and preserve @import, @charset and other single-line @-rules
  const atRules = []
  processed = processed.replace(/^@(import|charset)[^;]+;\s*$/gm, (match) => {
    atRules.push(match.trim())
    return '' // Remove completely
  })

  // Step 3: Apply scoping
  processed = processed.replace(
    /([^{}]+)\{/g,
    (match, selector) => {
      // Skip @-rules with braces (@font-face, @media, @keyframes, etc)
      const trimmed = selector.trim()
      if (trimmed.startsWith('@')) return match

      // Preserve leading/trailing whitespace (including newlines)
      const leadingWhitespace = selector.match(/^\s*/)[0]
      const trailingWhitespace = selector.match(/\s*$/)[0]

      // Split multiple selectors (e.g., "a, b, c { }")
      const scoped = selector
        .split(',')
        .map(s => {
          s = s.trim()
          if (!s) return s

          // Already scoped? Skip
          if (s.includes(scopeClass)) return s

          // Replace .card with .anki-card (applies to the element itself)
          if (s === '.card' || s.startsWith('.card ') || s.startsWith('.card:') || s.startsWith('.card.')) {
            return s.replace(/^\.card\b/, scopeClass)
          }

          // Special handling for :root and html/body
          if (s === ':root' || s === 'html' || s === 'body') {
            return scopeClass
          }

          // Scope other selectors as descendants
          return `${scopeClass} ${s}`
        })
        .join(', ')

      return `${leadingWhitespace}${scoped}${trailingWhitespace}{`
    }
  )

  // Step 4: Prepend @-rules at the beginning
  const result = atRules.length > 0
    ? atRules.join('\n') + '\n' + processed
    : processed

  // log.debug('css', css)
  // log.debug('scoped css', result)
  return result
}

// Platform detection for Anki CSS classes
export  const ankiClasses = () => {
  if (typeof window === 'undefined') return 'anki-card'

  const platform = detectPlatform()
  let classes = 'anki-card'

  if (platform.isMobile) classes += ' mobile'
  if (platform.isIOS || platform.os === 'macos') classes += ' mac'

  return classes
}
