import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { Mdict } from 'js-mdict'
import sanitizeHtml from 'sanitize-html'
import { log } from '../../utils/logger.js'

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
  const sanitizeCfg = {
    allowedTags: [
      'a', 'b', 'strong', 'i', 'em', 'u', 'span', 'div', 'p', 'br', 'ul', 'ol', 'li', 'sub', 'sup', 'blockquote', 'code', 'pre'
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      span: ['class'],
      div: ['class'],
      p: ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false
  }

  const safeDef = def.html ? sanitizeHtml(def.html, sanitizeCfg) : null
  const safeThes = thes.html ? sanitizeHtml(thes.html, sanitizeCfg) : null

  return {
    source: def.source,
    definitionHtml: safeDef,
    thesaurusHtml: safeThes
  }
}


