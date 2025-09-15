import Dexie from 'dexie'

// Simple media DB used by both dev and prod service workers
const db = new Dexie('MediaDB')
db.version(1).stores({ media: 'id, type, refCount, created' })

export function attachMediaHandler(selfRef = self) {
  selfRef.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/media/')) return

    event.respondWith(handleMediaRequest(request, url))
  })
}

export async function handleMediaRequest(request, url) {
  const id = url.pathname.replace('/media/', '')
  if (!id) return new Response('Not Found', { status: 404 })

  try {
    const media = await db.media.get(id)
    if (!media?.blob) {
      return new Response('Media Not Found', { status: 404 })
    }

    const blob = media.blob
    const type = media.type || 'application/octet-stream'

    const rangeHeader = request.headers.get('Range')
    if (!rangeHeader) {
      return new Response(blob, {
        headers: {
          'Content-Type': type
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

    const sliced = blob.slice(start, end + 1, type)
    return new Response(sliced, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes'
      }
    })
  } catch (err) {
    return new Response('Error: ' + (err && err.message ? err.message : 'unknown'), { status: 500 })
  }
}



