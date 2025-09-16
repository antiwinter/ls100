import { parseTemplate, parseToken } from './parser.js'
import { applyFilters } from './filters/index.js'

// Public surface, small and focused

export function checkEligibility(template, { fieldValues, fieldDefs }) {
  const qfmt = template?.qfmt || ''
  const fields = fieldValues || []
  const defs = fieldDefs || []

  // Minimal implementation: reuse internal conditional detector
  const conditionalMatches = qfmt.match(/\{\{#([^}]+)\}\}/g)
  if (!conditionalMatches) return true
  for (const m of conditionalMatches) {
    const name = m.replace(/\{\{#([^}]+)\}\}/, '$1').trim()
    const idx = defs.findIndex(f => (f.name || f).toLowerCase() === name.toLowerCase())
    if (idx === -1) return false
    const val = fields[idx]
    if (!val || val.trim() === '') return false
  }
  return true
}

export async function renderTemplate(template, ctx) {
  const { fieldValues = [], fieldDefs = [], bundleCss } = ctx || {}

  const fieldNames = fieldDefs.map(f => f.name || f)

  function hasContent(field) {
    const i = fieldNames.findIndex(n => n.toLowerCase() === (field || '').toLowerCase())
    const v = i !== -1 ? (fieldValues[i] || '') : ''
    return !!(v && String(v).trim())
  }

  function resolveBlocks(str) {
    if (!str) return ''
    const re = /\{\{([#^])\s*([^}]+)\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g
    let prev
    let out = str
    // Iterate until no more blocks (to handle simple nesting)
    do {
      prev = out
      out = out.replace(re, (_m, sig, name, body) => {
        const ok = hasContent(name)
        if (sig === '#') return ok ? body : ''
        else return ok ? '' : body
      })
    } while (out !== prev)
    return out
  }

  async function renderContent(src, frontSideHtml) {
    const src2 = resolveBlocks(src)
    const parts = parseTemplate(src2 || '')
    const env = { fieldNames, noteFields: fieldValues, side: 'front' }
    const out = parts.map(p => {
      if (p.type !== 'token') return p.value
      const t = parseToken(p.token)
      if (t.kind === 'front') return frontSideHtml || ''
      if (t.kind === 'field') {
        const i = fieldNames.findIndex(n => n.toLowerCase() === t.field.toLowerCase())
        return i !== -1 ? (fieldValues[i] || '') : ''
      }
      if (t.kind === 'filtered') {
        return applyFilters(t.field, t.filters, env)
      }
      return ''
    })
    return out.join('')
  }

  const question = await renderContent(template?.qfmt || '', '')
  const answer = await renderContent(template?.afmt || '', question)
  return { question, answer, css: bundleCss, meta: {} }
}


