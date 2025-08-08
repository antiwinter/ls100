import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { Mdict } from 'js-mdict'
import sanitizeHtml from 'sanitize-html'
import { log } from '../../utils/logger.js'
// Toggle HTML sanitization (temporarily disabled per request)
const SANITIZE = false

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const files = {
  ece: path.join(__dirname, 'Collins-Advanced-ECE.mdx'),
  ee: path.join(__dirname, 'Collins-Advanced-EE-3th.mdx'),
  thesaurus: path.join(__dirname, 'Collins-Thesaurus.mdx')
}

let dicts = {
  ece: null,
  ee: null,
  thesaurus: null
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const processCollinsHtml = (word, html) => {
  if (!html) return html
  let out = html

  try {
    // 1) Remove duplicated head word preceding star rating, like "would ★★★★★"
    const w = escapeRegExp(word)
    out = out.replace(new RegExp(`(<[^>]*>\n?)*${w}\\s*(?=<[^>]*>\\n?<font[^>]*>\\s*[★☆])`, 'i'), '')

    // 2) Remove "Usage Note" label (handle tags/spaces/nbsp between words)
    // Simple direct forms
    out = out.replace(/Usage\s*Note[s]?\s*[:：]?\s*/gi, '')
    // Forms with inline tags or &nbsp; between words
    out = out.replace(/Usage(?:\s|&nbsp;|<[^>]{1,80}>)*Note(?:\s*[:：])?/gi, '')

    // 4) Replace full-width brackets with <b>...</b>
    out = out.replace(/【([^】]+)】/g, '<b>$1</b>')

    // 3) Increase padding for elements with class "caption"
    // If a style attribute exists, append padding; otherwise add a new style attribute
    out = out.replace(/<([a-zA-Z]+)([^>]*\bclass=("|')[^>]*?\bcaption\b[^>]*?(\3))([^>]*)>/g, (m, tag, before, q, _q2, after) => {
      if (/style=("|')/i.test(m)) {
        return m.replace(/style=("|')(.*?)(\1)/i, (sm, q2, styles, _q3) => {
          const sep = styles.trim().length && !styles.trim().endsWith(';') ? '; ' : ' '
          return `style=${q2}${styles}${sep}padding:8px 10px${q2}`
        })
      }
      return `<${tag}${before} style="padding:8px 10px"${after}>`
    })

    // 5) Remove a dangling colon text node between tags (e.g., "> : <")
    out = out.replace(new RegExp('>\\s*[:：]\\s*(?=<)', 'g'), '>')
  } catch (e) {
    log.warn({ err: e?.message }, 'Collins HTML post-process failed, returning original')
    return html
  }

  return out
}

const loadOne = (label, file) => {
  try {
    if (!existsSync(file)) return null
    const d = new Mdict(file)
    log.info({ label, file }, 'Collins dictionary loaded')
    return d
  } catch (e) {
    log.error({ label, file, err: e?.message }, 'Failed to load Collins dictionary')
    return null
  }
}

// Preload (module scope)
dicts.ece = loadOne('ECE', files.ece)
dicts.ee = loadOne('EE', files.ee)
dicts.thesaurus = loadOne('THESAURUS', files.thesaurus)

const lookupFromDict = (dict, word) => {
  if (!dict || !word) return null
  const tryWord = (w) => {
    const keyBlock = dict.lookupKeyBlockByWord(w)
    if (!keyBlock) return null
    const record = dict.lookupRecordByKeyBlock(keyBlock)
    if (!record) return null
    return record.toString('utf8')
  }
  return tryWord(word) || tryWord(word.toLowerCase())
}

const lookupDefinition = (word) => {
  const fromEce = lookupFromDict(dicts.ece, word)
  if (fromEce) return { html: fromEce, source: 'ECE' }
  const fromEe = lookupFromDict(dicts.ee, word)
  if (fromEe) return { html: fromEe, source: 'EE' }
  return { html: null, source: null }
}

const lookupThesaurus = (word) => {
  const html = lookupFromDict(dicts.thesaurus, word)
  return html ? { html } : { html: null }
}

export const lookup = (word) => {
  const def = lookupDefinition(word)
  const thes = lookupThesaurus(word)
  if (SANITIZE) {
    const cfg = {
      allowedTags: [
        'a', 'b', 'strong', 'i', 'em', 'u', 'span', 'div', 'p', 'br', 'ul', 'ol', 'li', 'sub', 'sup', 'blockquote', 'code', 'pre'
      ],
      allowedAttributes: { a: ['href', 'title'], span: ['class'], div: ['class'], p: ['class'] },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowProtocolRelative: false
    }
    const merged = [def.html, thes.html].filter(Boolean).map(h => processCollinsHtml(word, h)).join('\n') || null
    return {
      source: def.source,
      definitionHtml: merged ? sanitizeHtml(merged, cfg) : null
    }
  }

  const merged = [def.html, thes.html].filter(Boolean).map(h => processCollinsHtml(word, h)).join('\n') || null
  return { source: def.source, definitionHtml: merged }
}


