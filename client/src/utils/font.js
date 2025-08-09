// Platform-aware font stacks for English and CJK
// mode: 'sans' | 'serif'
export const fontStack = (mode = 'sans') => {
  if (mode === 'serif') {
    // Serif stack: English first, then CJK serif families per platform
    return [
      'Georgia',
      'Cambria',
      'Times New Roman',
      'Noto Serif',
      'Source Han Serif SC', // Adobe/Google CJK Serif
      'Songti SC', // macOS Simplified Chinese serif
      'SimSun', // Windows Simplified Chinese serif
      'Hiragino Mincho ProN', // Japanese serif
      'Yu Mincho',
      'serif'
    ].join(', ')
  }
  // Sans-serif default: English system stack + CJK sans
  return [
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'Helvetica',
    'Arial',
    'Noto Sans',
    'PingFang SC', // macOS Simplified Chinese sans
    'Hiragino Sans GB', // macOS Chinese sans
    'Microsoft YaHei', // Windows Chinese sans
    'Heiti SC',
    'sans-serif'
  ].join(', ')
}


