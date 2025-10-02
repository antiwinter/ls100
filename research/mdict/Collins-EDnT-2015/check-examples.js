import fs from 'fs'
import * as cheerio from 'cheerio'

const html = fs.readFileSync('samples/ability.html', 'utf8')
const $ = cheerio.load(html)

console.log('=== First .iji (definition) full structure ===')
const firstIji = $('.iji').first()
console.log(firstIji.html())

console.log('\n\n=== Does it have .u9w? ===')
console.log('.u9w count in first .iji:', firstIji.find('.u9w').length)
if (firstIji.find('.u9w').length > 0) {
  console.log('.u9w text:', firstIji.find('.u9w').first().text())
}

