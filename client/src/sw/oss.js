import { decompress as dec } from 'fzstd'
import { log } from './util.js'
import { fileTypeFromBuffer } from 'file-type'
import oss from '../utils/oss.js'

// Decompress and detect proper MIME type
const processObj = async (obj) => {
  const { blob } = obj
  try {
    let x = new Uint8Array(await blob.arrayBuffer())

    // Check if zstd compressed and decompress
    let type = await fileTypeFromBuffer(x)
    let _l = x.length
    if (type?.ext === 'zst') {
      x = dec(x)
      type = await fileTypeFromBuffer(x)
    }

    type = type?.mime || obj.type || blob.type || 'application/octet-stream'
    // log.debug('processed obj', obj.filename, type, _l, x.length)
    return new Blob([x], { type })
  } catch (error) {
    log.warn('processObj failed', error)
    return blob
  }
}

export function attachOssHandler(selfRef = self) {
  selfRef.addEventListener('fetch', (event) => {
    // log.info('OSS handler fetch event', event)

    const { request } = event
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/oss/')) return

    event.respondWith(handleOssRequest(request, url))
  })
}

export async function handleOssRequest(request, url) {
  const id = url.pathname.replace('/oss/', '')

  try {
    const obj = await oss.getObj(id)
    if (!obj?.blob) {
      return new Response('Object Not Found', { status: 404 })
    }

    // Decompress and detect proper MIME type
    const blob = await processObj(obj)

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
