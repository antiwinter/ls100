import { useState, useEffect } from 'react'

// Platform detection utility hook
export const useDetectPlatform = () => {
  const [platform, setPlatform] = useState({
    os: 'unknown',
    browser: 'unknown',
    isMobile: false,
    isIOS: false,
    isAndroid: false,
    isStandalone: false,
    shouldShowPWAHint: false
  })

  useEffect(() => {
    const detectPlatform = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      
      // OS Detection
      let os = 'unknown'
      let isIOS = false
      let isAndroid = false
      
      if (/ipad|iphone|ipod/.test(userAgent)) {
        os = 'ios'
        isIOS = true
      } else if (/android/.test(userAgent)) {
        os = 'android'
        isAndroid = true
      } else if (/windows/.test(userAgent)) {
        os = 'windows'
      } else if (/macintosh|mac os x/.test(userAgent)) {
        os = 'macos'
      } else if (/linux/.test(userAgent)) {
        os = 'linux'
      }

      // Browser Detection
      let browser = 'unknown'
      if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
        browser = 'safari'
      } else if (/chrome/.test(userAgent)) {
        browser = 'chrome'
      } else if (/firefox/.test(userAgent)) {
        browser = 'firefox'
      } else if (/edge/.test(userAgent)) {
        browser = 'edge'
      } else if (/opera/.test(userAgent)) {
        browser = 'opera'
      }

      // Mobile Detection
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)

      // Standalone (PWA) Detection
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          window.navigator.standalone === true

      // Should show PWA hint logic
      const shouldShowPWAHint = isMobile && !isStandalone

      return {
        os,
        browser,
        isMobile,
        isIOS,
        isAndroid,
        isStandalone,
        shouldShowPWAHint
      }
    }

    setPlatform(detectPlatform())
  }, [])

  return platform
}

// Static utility functions for non-hook contexts
export const detectPlatform = () => {
  const userAgent = navigator.userAgent.toLowerCase()
  
  // OS Detection
  let os = 'unknown'
  let isIOS = false
  let isAndroid = false
  
  if (/ipad|iphone|ipod/.test(userAgent)) {
    os = 'ios'
    isIOS = true
  } else if (/android/.test(userAgent)) {
    os = 'android'
    isAndroid = true
  } else if (/windows/.test(userAgent)) {
    os = 'windows'
  } else if (/macintosh|mac os x/.test(userAgent)) {
    os = 'macos'
  } else if (/linux/.test(userAgent)) {
    os = 'linux'
  }

  // Browser Detection
  let browser = 'unknown'
  if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
    browser = 'safari'
  } else if (/chrome/.test(userAgent)) {
    browser = 'chrome'
  } else if (/firefox/.test(userAgent)) {
    browser = 'firefox'
  } else if (/edge/.test(userAgent)) {
    browser = 'edge'
  } else if (/opera/.test(userAgent)) {
    browser = 'opera'
  }

  // Mobile Detection
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)

  // Standalone (PWA) Detection
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone === true

  return {
    os,
    browser,
    isMobile,
    isIOS,
    isAndroid,
    isStandalone,
    isMobileBrowser: isMobile && !isStandalone
  }
}
