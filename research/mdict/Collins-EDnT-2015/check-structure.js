import fs from 'fs'
import * as cheerio from 'cheerio'

const html = fs.readFileSync('samples/ability.html', 'utf8')
const $ = cheerio.load(html)

console.log('=== POS section (.x5z) structure ===')
$('.x5z').first().children().each((i, el) => {
  const tag = el.name
  const cls = $(el).attr('class') || '(no class)'
  console.log(`  ${i}: <${tag} class="${cls}">`)
  
  // If it's oyu, show its children
  if (cls.includes('oyu')) {
    console.log('    oyu children:')
    $(el).children().each((j, child) => {
      const ctag = child.name
      const ccls = $(child).attr('class') || '(no class)'
      console.log(`      ${j}: <${ctag} class="${ccls}">`)
    })
  }
})

console.log('\n=== First .iji (definition item) ===')
const firstIji = $('.iji').first()
console.log('Parent:', firstIji.parent().attr('class'))
console.log('Grandparent:', firstIji.parent().parent().attr('class'))
console.log('Great-grandparent:', firstIji.parent().parent().parent().attr('class'))

console.log('\n=== .iji children ===')
firstIji.children().each((i, el) => {
  const tag = el.name
  const cls = $(el).attr('class') || '(no class)'
  const text = $(el).text().substring(0, 60)
  console.log(`  ${i}: <${tag} class="${cls}"> "${text}..."`)
})
