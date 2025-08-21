// Comprehensive font database with platform and language support
export const FONT_DATABASE = [
  // English fonts
  { fontName: 'Georgia', platform: 'all', langCode: 'en', type: 'serif' },
  { fontName: 'Arial', platform: 'all', langCode: 'en', type: 'sans' },
  { fontName: 'system-ui', platform: 'all', langCode: 'en', type: 'sans' },

  { fontName: 'San Francisco', platform: 'macos', langCode: 'en', type: 'serif' },
  { fontName: 'Helvetica', platform: 'macos', langCode: 'en', type: 'sans' },
  { fontName: 'Segoe UI', platform: 'windows', langCode: 'en', type: 'sans' },
  { fontName: 'Cambria', platform: 'windows', langCode: 'en', type: 'serif' },
  { fontName: 'Roboto', platform: 'android', langCode: 'en', type: 'sans' },

  // Chinese fonts
  { fontName: 'Songti SC', platform: 'macos', langCode: 'zh', type: 'serif' },
  { fontName: 'SimSun', platform: 'windows', langCode: 'zh', type: 'serif' },
  { fontName: 'Source Han Serif SC', platform: 'all', langCode: 'zh', type: 'serif' },
  { fontName: 'Noto Serif CJK SC', platform: 'all', langCode: 'zh', type: 'serif' },

  { fontName: 'PingFang SC', platform: 'macos', langCode: 'zh', type: 'sans' },
  { fontName: 'Hiragino Sans GB', platform: 'macos', langCode: 'zh', type: 'sans' },
  { fontName: 'Microsoft YaHei', platform: 'windows', langCode: 'zh', type: 'sans' },
  { fontName: 'Heiti SC', platform: 'macos', langCode: 'zh', type: 'sans' },
  { fontName: 'Source Han Sans SC', platform: 'all', langCode: 'zh', type: 'sans' },
  { fontName: 'Noto Sans CJK SC', platform: 'all', langCode: 'zh', type: 'sans' },

  // Japanese fonts
  { fontName: 'Hiragino Mincho ProN', platform: 'macos', langCode: 'ja', type: 'serif' },
  { fontName: 'Yu Mincho', platform: 'windows', langCode: 'ja', type: 'serif' },
  { fontName: 'Source Han Serif JP', platform: 'all', langCode: 'ja', type: 'serif' },
  { fontName: 'Noto Serif CJK JP', platform: 'all', langCode: 'ja', type: 'serif' },

  { fontName: 'Hiragino Kaku Gothic ProN', platform: 'macos', langCode: 'ja', type: 'sans' },
  { fontName: 'Yu Gothic', platform: 'windows', langCode: 'ja', type: 'sans' },
  { fontName: 'Source Han Sans JP', platform: 'all', langCode: 'ja', type: 'sans' },
  { fontName: 'Noto Sans CJK JP', platform: 'all', langCode: 'ja', type: 'sans' },

  // Korean fonts
  { fontName: 'Apple SD Gothic Neo', platform: 'macos', langCode: 'ko', type: 'sans' },
  { fontName: 'Malgun Gothic', platform: 'windows', langCode: 'ko', type: 'sans' },
  { fontName: 'Source Han Sans KR', platform: 'all', langCode: 'ko', type: 'sans' },
  { fontName: 'Noto Sans CJK KR', platform: 'all', langCode: 'ko', type: 'sans' },

  // Spanish fonts
  { fontName: 'Georgia', platform: 'all', langCode: 'es', type: 'serif' },
  { fontName: 'Times New Roman', platform: 'all', langCode: 'es', type: 'serif' },
  { fontName: 'Arial', platform: 'all', langCode: 'es', type: 'sans' },
  { fontName: 'Helvetica', platform: 'macos', langCode: 'es', type: 'sans' },

  // French fonts
  { fontName: 'Georgia', platform: 'all', langCode: 'fr', type: 'serif' },
  { fontName: 'Times New Roman', platform: 'all', langCode: 'fr', type: 'serif' },
  { fontName: 'Arial', platform: 'all', langCode: 'fr', type: 'sans' },
  { fontName: 'Helvetica', platform: 'macos', langCode: 'fr', type: 'sans' }
]

import { detectPlatform } from './useDetectPlatform'

// Get available fonts for current platform and language
export const getAvailableFonts = (langCode) => {
  const { os } = detectPlatform()

  const fonts = FONT_DATABASE.filter(font => {
    const platformMatch = font.platform === os || font.platform === 'all'
    const langMatch = font.langCode === langCode
    return platformMatch && langMatch
  })

  // Sort: system -> sans -> serif
  const sortedFonts = fonts.sort((a, b) => {
    const getTypeOrder = (font) => {
      if (font.fontName === 'system-ui') return 0
      if (font.type === 'sans') return 1
      if (font.type === 'serif') return 2
      return 3
    }
    return getTypeOrder(a) - getTypeOrder(b)
  })

  return { os, fonts: sortedFonts }
}
