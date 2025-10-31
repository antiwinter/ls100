import { useState, useEffect } from 'react'
import { Box, IconButton, Typography } from '@mui/joy'
import { XIcon } from '@phosphor-icons/react'
import { SimpleEditor } from '../../../../components/SimpleEditor.jsx'
import db from '../../core/db.js'
import mediaManager from '../../core/mediaManager.js'
import oss from '../../../../utils/oss.js'
import { log } from '../../../../utils/logger'

export const Notebox = ({ card, onClose }) => {
  const [html, setHtml] = useState('')

  // Load existing userNote on mount
  useEffect(() => {
    if (card?.userNote) {
      setHtml(card.userNote)
    }
  }, [card])

  // Save on unmount
  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (!html) return

          // Extract blob URLs from HTML
          const parser = new DOMParser()
          const doc = parser.parseFromString(html, 'text/html')
          const audioElements = doc.querySelectorAll('audio-note')

          let finalHtml = html

          // Process each audio element
          for (const el of audioElements) {
            const src = el.getAttribute('src')

            // Only process blob URLs (new recordings)
            if (src && src.startsWith('blob:')) {
              try {
                // Fetch blob from object URL
                const response = await fetch(src)
                const blob = await response.blob()

                // Save to OSS via mediaManager
                const filename = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`
                await mediaManager.add(card.bundleId, card.id, { [filename]: blob })

                // Get nvId for the saved blob
                const nvId = await oss.blob2NvId(blob)

                // Replace blob URL with /oss/{nvid} URL
                finalHtml = finalHtml.replace(src, `/oss/${nvId}`)

                // Revoke object URL
                URL.revokeObjectURL(src)
              } catch (error) {
                log.error('Failed to save audio blob:', error)
              }
            }
          }

          // Save final HTML to database
          await db.cards.update(card.id, { userNote: finalHtml })

          log.debug('Notebox saved:', { cardId: card.id, userNote: finalHtml })
        } catch (error) {
          log.error('Failed to save notebox:', error)
        }
      })()
    }
  }, [html, card])

  // Handle HTML change from SimpleEditor
  const handleChange = (newHtml) => {
    setHtml(newHtml)
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
      <SimpleEditor html={html} onChange={handleChange} />
    </Box>
  )
}

