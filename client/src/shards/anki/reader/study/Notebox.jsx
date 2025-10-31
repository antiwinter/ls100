import { useRef, useEffect } from 'react'
import { Box, IconButton, Typography } from '@mui/joy'
import { XIcon } from '@phosphor-icons/react'
import { SimpleEditor } from '../../../../components/SimpleEditor.jsx'
import db from '../../core/db.js'
import mediaManager from '../../core/mediaManager.js'
import oss from '../../../../utils/oss.js'
import { log } from '../../../../utils/logger'

export const Notebox = ({ card, onClose }) => {
  const htmlRef = useRef(card?.userNote || '')
  const blobsRef = useRef({})
  const initialHtmlRef = useRef(card?.userNote || '')

  // Extract nvIds from HTML
  const extractNvIds = (html) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const audioElements = doc.querySelectorAll('audio-note')
    const nvIds = []
    audioElements.forEach(el => {
      const src = el.getAttribute('src')
      if (src && src.startsWith('/oss/')) {
        nvIds.push(src.replace('/oss/', ''))
      }
    })
    return nvIds
  }

  // Save on unmount
  useEffect(() => {
    const initialHtml = initialHtmlRef.current
    return () => {
      (async () => {
        try {
          const html = htmlRef.current
          const blobs = blobsRef.current

          // 1. Get initial nvIds (what was owned before)
          const initialNvIds = extractNvIds(initialHtml)

          // 3. Get final nvIds (what should be owned now)
          const currentNvIds = extractNvIds(html)

          // 4. Remove unused media: initialNvIds - finalNvIds
          const toRemove = initialNvIds.filter(nvId => !currentNvIds.includes(nvId))
          await mediaManager.removeByNvid(card.bundleId, card.id, toRemove)

          // 2. Process blobs and build final HTML
          const parser = new DOMParser()
          const doc = parser.parseFromString(html, 'text/html')
          const audioElements = doc.querySelectorAll('audio-note')

          for (const el of audioElements) {
            const filename = el.getAttribute('data-filename')
            const objUrl = el.getAttribute('src')
            // Revoke old blob URL
            if (!objUrl?.startsWith?.('blob:')) continue
            if (!filename || !blobs[filename]) {
              log.warn('Failed to save audio blob:', { filename, objUrl })
              continue
            }

            try {
              const blob = blobs[filename]

              // Save to OSS via mediaManager
              await mediaManager.add(card.bundleId, card.id, { [filename]: blob })

              // Get nvId for the saved blob
              const nvId = await oss.blob2NvId(blob)

              // Update src and cleanup
              el.setAttribute('src', `/oss/${nvId}`)
              el.removeAttribute('data-filename')
              URL.revokeObjectURL(objUrl)
            } catch (error) {
              log.error('Failed to save audio blob:', error)
            }
          }

          // 5. Save final HTML to database
          const userNote = doc.body.innerHTML
          await db.cards.update(card.id, { userNote })

          log.debug('Notebox saved:', { cardId: card.id, userNote })
        } catch (error) {
          log.error('Failed to save notebox:', error)
        }
      })()
    }
  }, [card])

  // Handle HTML change from SimpleEditor
  const handleChange = (newHtml, newBlobs) => {
    htmlRef.current = newHtml
    blobsRef.current = newBlobs
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, pb: 0 }}>
        <Typography level="title-lg">Note</Typography>
        <IconButton size="sm" variant="plain" onClick={() => onClose?.()}>
          <XIcon size={20} />
        </IconButton>
      </Box>

      {/* Editor */}
      <SimpleEditor html={htmlRef.current} onChange={handleChange} />
    </Box>
  )
}

