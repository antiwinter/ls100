import fs from 'fs'
import * as cheerio from 'cheerio'

const html = fs.readFileSync('samples/ability.html', 'utf8')
const $ = cheerio.load(html)

console.log('=== .quf (headword) structure ===')
const quf = $('.quf').first()
console.log('quf HTML:', quf.html().substring(0, 200))

console.log('\n=== .quf children ===')
quf.children().each((i, el) => {
  const tag = el.name
  const cls = $(el).attr('class') || '(no class)'
  const text = $(el).text().substring(0, 50)
  console.log(`  ${i}: <${tag} class="${cls}"> "${text}..."`)
})

console.log('\n=== Where is .kf5? ===')
const kf5 = $('.kf5').first()
console.log('kf5 parent:', kf5.parent().attr('class') || kf5.parent()[0].name)
console.log('kf5 text:', kf5.text())

