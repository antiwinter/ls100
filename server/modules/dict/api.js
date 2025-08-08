import express from 'express'
import * as collins from '../../lib/collins/index.js'
import { requireAuth } from '../../utils/auth-middleware.js'
import { log } from '../../utils/logger.js'

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

    // If neither ECE nor EE have definition but thesaurus exists, still 200
    if (!result.definitionHtml && !result.thesaurusHtml) {
      return res.status(404).json({ error: 'Word not found', searched: word })
    }

    return res.json({
      searchedWord: word,
      source: result.source,
      definitionHtml: result.definitionHtml,
      thesaurusHtml: result.thesaurusHtml
    })
  } catch (e) {
    log.error({ err: e?.message, word }, 'Dictionary lookup failed')
    return res.status(500).json({ error: 'Dictionary lookup failed' })
  }
})

export default router


