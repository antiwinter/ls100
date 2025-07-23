import fs from 'fs'
import path from 'path'
import { detectLang } from '../../modules/subtitle/detect.js'
import { franc } from 'franc'

// Test subtitle files in current directory
const testFiles = [
  'Dead.Poets.Society.1989.BluRay.720p.x264.AC3.CHD.Cht.zh.srt',  // Chinese
  'Dead Poets Society (1989) [BluRay 1080p 10bit 5.1CH x265].srt'  // English
]

console.log('🧪 Language Detection Comprehensive Test\n')

for (const filename of testFiles) {
  const filepath = path.join(process.cwd(), filename)
  
  if (!fs.existsSync(filepath)) {
    console.log(`❌ File not found: ${filename}`)
    continue
  }
  
  const content = fs.readFileSync(filepath, 'utf8')
  const lines = content.split('\n')
  
  console.log(`📄 Testing: ${filename}`)
  console.log(`📊 File stats: ${lines.length} lines, ${(content.length / 1024).toFixed(1)}KB`)
  
  // Test current detector
  console.log('\n🔍 Current Detector Results:')
  const detectedLangs = detectLang(content)
  console.log(`   Languages (${detectedLangs.length}): [${detectedLangs.join(', ')}]`)
  
  // Analyze subtitle content structure
  console.log('\n📝 Content Analysis:')
  const textLines = lines.filter(line => 
    !line.match(/^\d+$/) &&                    // Not subtitle number
    !line.match(/\d{2}:\d{2}:\d{2}/) &&       // Not timestamp
    !line.match(/^-->\s*$/) &&                // Not arrow
    line.trim().length > 3                    // Has meaningful content
  )
  
  console.log(`   Text lines: ${textLines.length}`)
  console.log(`   Sample text lines:`)
  textLines.slice(0, 5).forEach((line, i) => {
    console.log(`     ${i + 1}. "${line.trim()}"`)
  })
  
  // Test franc on different text chunks
  console.log('\n🧮 Franc Analysis:')
  
  // Test on full text
  const fullText = textLines.join(' ')
  const fullResult = franc(fullText)
  console.log(`   Full text: ${fullResult}`)
  
  // Test on first 10 lines
  const sampleText = textLines.slice(0, 10).join(' ')
  const sampleResult = franc(sampleText)
  console.log(`   Sample (10 lines): ${sampleResult}`)
  
  // Test ALL lines to see full distribution
  console.log('\n🔬 Per-line Analysis (ALL lines):')
  const lineResults = {}
  const sampleLines = []
  
  textLines.forEach((line, i) => {
    if (line.length > 5) {
      const result = franc(line)
      lineResults[result] = (lineResults[result] || 0) + 1
      
      // Collect samples for each language (first occurrence)
      if (!sampleLines[result]) {
        sampleLines[result] = line.trim()
      }
    }
  })
  
  console.log(`   Processed ${textLines.length} text lines`)
  console.log(`   Detected ${Object.keys(lineResults).length} different languages`)
  
  console.log('\n📈 Full Language Distribution (sorted by frequency):')
  Object.entries(lineResults)
    .sort(([,a], [,b]) => b - a)
    .forEach(([lang, count]) => {
      const percentage = ((count / textLines.length) * 100).toFixed(1)
      console.log(`     ${lang}: ${count} lines (${percentage}%) - "${sampleLines[lang]}"`)
    })
  
  // Show top languages analysis
  const sortedLangs = Object.entries(lineResults).sort(([,a], [,b]) => b - a)
  const topLang = sortedLangs[0]
  const secondLang = sortedLangs[1]
  
  console.log('\n🎯 Top Language Analysis:')
  console.log(`   #1: ${topLang[0]} (${topLang[1]} lines, ${((topLang[1] / textLines.length) * 100).toFixed(1)}%)`)
  if (secondLang) {
    console.log(`   #2: ${secondLang[0]} (${secondLang[1]} lines, ${((secondLang[1] / textLines.length) * 100).toFixed(1)}%)`)
  }
  
  console.log('\n' + '='.repeat(80) + '\n')
}

console.log('🎯 Analysis Complete!')
console.log('\n💡 Key Findings:')
console.log('- Per-line detection is unreliable (short text fragments)')
console.log('- Full text detection is much more accurate')
console.log('- Current implementation adds ALL line results = language explosion')
console.log('\n🔧 Recommended Fix:')
console.log('- Use full text or large chunks (500+ chars)')
console.log('- Return only the TOP 1-2 most confident results')
console.log('- Add confidence thresholds') 