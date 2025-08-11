import { log } from './logger'

// Generate Eudic-compatible XML wordbook format
export const generateEudicXML = (words, movieName = '') => {
  log.debug(`Generating XML for ${words.length} words from ${movieName}`)
  
  let xml = '<wordbook>\n'
  
  words.forEach(word => {
    xml += '  <item>\n'
    xml += `    <word>${escapeXML(word)}</word>\n`
    xml += `    <trans><![CDATA[From: ${movieName}]]></trans>\n`
    xml += '  </item>\n'
  })
  
  xml += '</wordbook>\n'
  
  log.debug(`Generated XML: ${xml.length} characters`)
  return xml
}

// Escape XML special characters
const escapeXML = (str) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Download file to user's device
export const downloadFile = (content, filename, mimeType = 'text/plain') => {
  log.debug(`Downloading file: ${filename}`)
  
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  
  a.href = url
  a.download = filename
  a.style.display = 'none'
  
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Check if running on mobile device
export const isMobile = () => {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Detect if Eudic app is available on mobile
export const detectEudicApp = async () => {
  if (!isMobile()) return false
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 1500)
    
    // Create hidden iframe to test URL scheme
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.style.width = '1px'
    iframe.style.height = '1px'
    
    const cleanup = () => {
      clearTimeout(timeout)
      if (iframe.parentNode) {
        document.body.removeChild(iframe)
      }
    }
    
    // Test Eudic URL schemes
    iframe.src = 'eudic://'
    
    iframe.onload = () => {
      cleanup()
      resolve(true)
    }
    
    iframe.onerror = () => {
      cleanup()
      resolve(false)
    }
    
    document.body.appendChild(iframe)
    
    // Fallback timeout
    setTimeout(() => {
      cleanup()
      resolve(false)
    }, 1500)
  })
}

// Send XML content to Eudic app via URL scheme
export const sendToEudicApp = (xmlContent, filename) => {
  log.debug('Attempting to send to Eudic app')
  
  try {
    // Method 1: Try custom URL scheme with data
    const encoded = btoa(unescape(encodeURIComponent(xmlContent)))
    const eudicUrl = `eudic://import?data=${encoded}&filename=${encodeURIComponent(filename)}`
    
    window.location.href = eudicUrl
    
    return true
  } catch (error) {
    log.error('Failed to send to Eudic app:', error)
    return false
  }
}

// Enhanced download with mobile optimizations
export const downloadFileEnhanced = async (content, filename, mimeType = 'text/xml', options = {}) => {
  log.debug(`Enhanced download: ${filename}`)
  
  // Try mobile Eudic first if enabled
  if (options.tryEudic && isMobile()) {
    const hasEudic = await detectEudicApp()
    if (hasEudic) {
      const success = sendToEudicApp(content, filename)
      if (success) {
        log.debug('Successfully sent to Eudic app')
        return { method: 'eudic', success: true }
      }
    }
  }
  
  // Fallback to regular download
  try {
    const blob = new Blob([content], { type: mimeType })
    
    // Use different methods based on browser capabilities
    if (navigator.share && isMobile()) {
      // Try Web Share API on mobile
      const file = new File([blob], filename, { type: mimeType })
      await navigator.share({
        files: [file],
        title: 'Export from LS100'
      })
      return { method: 'share', success: true }
    } else {
      // Standard download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      
      a.href = url
      a.download = filename
      a.style.display = 'none'
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return { method: 'download', success: true }
    }
  } catch (error) {
    log.error('Enhanced download failed:', error)
    return { method: 'error', success: false, error }
  }
}

// Generate filename for export
export const generateFilename = (movieName, format = 'xml') => {
  const cleaned = movieName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
  const timestamp = new Date().toISOString().split('T')[0]
  return `${cleaned || 'wordbook'}_${timestamp}.${format}`
}
