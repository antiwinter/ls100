import Dexie from 'dexie'
import { decompress as dec } from 'fzstd'
import { log } from './util.js'
import { fileTypeFromBuffer } from 'file-type'

// Simple media DB used by both dev and prod service workers
const db = new Dexie('OssDB')
db.version(1).stores({ media: 'id, type, refCount, created' })

// Decompress and detect proper MIME type
const processMedia = async (media) => {
  const { blob } = media
  try {
    let x = new Uint8Array(await blob.arrayBuffer())

    // Check if zstd compressed and decompress
    let type = await fileTypeFromBuffer(x)
    let _l = x.length
    if (type?.ext === 'zst') {
      x = dec(x)
      type = await fileTypeFromBuffer(x)
    }

    type = type?.mime || media.type || blob.type || 'application/octet-stream'
    // log.debug('processed media', media.filename, type, _l, x.length)
    return new Blob([x], { type })
  } catch (error) {
    log.warn('processMedia failed', error)
    return blob
  }
}

export function attachMediaHandler(selfRef = self) {
  selfRef.addEventListener('fetch', (event) => {
    // log.info('Media handler fetch event', event)

    const { request } = event
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/media/')) return

    event.respondWith(handleMediaRequest(request, url))
  })
}

export async function handleMediaRequest(request, url) {
  const id = url.pathname.replace('/media/', '')

  try {
    const media = await db.media.get(id)
    if (!media?.blob) {
      return new Response('Media Not Found', { status: 404 })
    }

    // Decompress and detect proper MIME type
    const blob = await processMedia(media)

    const rangeHeader = request.headers.get('Range')
    if (!rangeHeader) {
      return new Response(blob, {
        headers: {
          'Content-Type': blob.type
        }
      })
    }

    const size = blob.size
    const bytesPrefix = 'bytes='
    if (!rangeHeader.startsWith(bytesPrefix)) {
      return new Response(null, { status: 416 })
    }
    let [startStr, endStr] = rangeHeader.substring(bytesPrefix.length).split('-')
    let start = parseInt(startStr, 10)
    let end = endStr ? parseInt(endStr, 10) : size - 1
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
      return new Response(null, { status: 416 })
    }

    const sliced = blob.slice(start, end + 1)
    return new Response(sliced, {
      status: 206,
      headers: {
        'Content-Type': blob.type,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes'
      }
    })
  } catch (err) {
    return new Response('Error: ' + (err && err.message ? err.message : 'unknown'), { status: 500 })
  }
}
