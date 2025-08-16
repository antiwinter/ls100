import express from 'express'
import * as collins from '../../lib/collins/index.js'
import lemmatizer from 'wink-lemmatizer'
import { requireAuth } from '../../utils/auth-middleware.js'
import { log } from '../../utils/logger.js'
import crypto from 'crypto'

const router = express.Router()

router.get('/lookup', requireAuth, (req, res) => {
  const word = (req.query.word || '').trim()
  const dict = (req.query.dict || 'collins').trim().toLowerCase()
  if (!word) return res.status(400).json({ error: 'Missing "word" query param' })

  try {
    let result = null
    if (dict === 'collins') {
      // First try exact
      result = collins.lookup(word)
      // If not found, attempt lemmatization fallback
      if (!result?.definitionHtml) {
        const lower = word.toLowerCase()
        const baseN = lemmatizer.noun(lower)
        const baseV = lemmatizer.verb(lower)
        const baseAdj = lemmatizer.adjective(lower)
        const tried = new Set([lower])
        for (const base of [baseN, baseV, baseAdj]) {
          if (base && !tried.has(base)) {
            tried.add(base)
            const r = collins.lookup(base)
            if (r?.definitionHtml) { result = r; break }
          }
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported dict', dict })
    }

    const body = {
      searchedWord: word,
      source: result.source,
      definitionHtml: result.definitionHtml,
      pronunciation: result.pronunciation,
      found: !!result.definitionHtml
    }

    // ETag based on content
    const hash = crypto
      .createHash('sha1')
      .update(JSON.stringify({ word: body.searchedWord, source: body.source, d: body.definitionHtml }))
      .digest('hex')
    const etag = `W/"${hash}"`
    res.setHeader('ETag', etag)
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')

    const ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end()
    }

    return res.status(200).json(body)
  } catch (e) {
    log.error({ err: e?.message, word }, 'Dictionary lookup failed')
    return res.status(500).json({ error: 'Dictionary lookup failed' })
  }
})

export default router


