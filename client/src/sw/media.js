import Dexie from 'dexie'
import { decompress as dec } from 'fzstd'
import { log } from './util.js'

// Simple media DB used by both dev and prod service workers
const db = new Dexie('MediaDB')
db.version(1).stores({ media: 'id, type, refCount, created' })

// Decompress blob based on compression type
const tryDec = async (media) => {
  const { blob } = media
  try {
    const x = new Uint8Array(await blob.arrayBuffer())

    if (x.length >= 4 &&
        x[0] === 0x28 && x[1] === 0xb5 &&
        x[2] === 0x2f && x[3] === 0xfd) {
      const d = dec(x)
      log.debug('Decompressed zstd', media.filename, x.length / 1000, d.length / 1000)
      return new Blob([d], { type: blob.type })
    }
  } catch (error) {
    log.warn('tryDec failed', error)
  }
  return blob
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

    // Decompress blob if needed
    // log.debug('Try dec media', media)
    const blob = await tryDec(media)

    const rangeHeader = request.headers.get('Range')
    if (!rangeHeader) {
      return new Response(blob)
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
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes'
      }
    })
  } catch (err) {
    return new Response('Error: ' + (err && err.message ? err.message : 'unknown'), { status: 500 })
  }
}
