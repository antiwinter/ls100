import express from 'express'
import * as collins from '../../lib/collins/index.js'
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
      result = collins.lookup(word)
    } else {
      return res.status(400).json({ error: 'Unsupported dict', dict })
    }

    const body = {
      searchedWord: word,
      source: result.source,
      definitionHtml: result.definitionHtml,
      thesaurusHtml: result.thesaurusHtml,
      found: !!(result.definitionHtml || result.thesaurusHtml)
    }

    // ETag based on content
    const hash = crypto
      .createHash('sha1')
      .update(JSON.stringify({ word: body.searchedWord, source: body.source, d: body.definitionHtml, t: body.thesaurusHtml }))
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


