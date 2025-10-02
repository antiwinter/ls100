// Test the label extraction regex

const text = "Accoutrements are all the things you have with you when you travel or when you take part in a particular activity. 【搭配模式】：usu pl【STYLE标签】：HUMOROUS or OLD-FASHIONED 幽默或过时"

console.log('Text:', text)
console.log()

// Test: Capture only English letters, spaces, hyphens until Chinese or 【
console.log('Test: Capture English only')
const pattern = /【(?:STYLE标签|语域标签|FIELD标签)】[：:]([A-Za-z\s-]+?)(?=\s*[\u4e00-\u9fa5【]|$)/g
let match
while ((match = pattern.exec(text)) !== null) {
  console.log('  Raw match:', JSON.stringify(match[1]))
  console.log('  Trimmed:', JSON.stringify(match[1].trim()))
  
  // Split on " or "
  const labels = match[1].trim().split(' or ').map(l => l.trim())
  console.log('  Labels:', labels)
  console.log()
}
