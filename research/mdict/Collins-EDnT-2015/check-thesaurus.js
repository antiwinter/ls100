import fs from 'fs'
import * as cheerio from 'cheerio'

const html = fs.readFileSync('samples/ability.html', 'utf8')
const $ = cheerio.load(html)

console.log('=== Thesaurus container (.tvr) ===')
const tvr = $('.tvr').first()
console.log('Found:', tvr.length)

console.log('\n=== Thesaurus entry structure ===')
tvr.find('.x5z').first().children().each((i, el) => {
  const tag = el.name
  const cls = $(el).attr('class') || '(no class)'
  console.log(`  ${i}: <${tag} class="${cls}">`)
})

console.log('\n=== First thesaurus item (.iji) ===')
const firstIji = tvr.find('.iji').first()
console.log('HTML:', firstIji.html().substring(0, 400))

console.log('\n=== Synonyms (.fxr) ===')
firstIji.find('.fxr').slice(0, 3).each((i, el) => {
  const text = $(el).text().trim()
  console.log(`  ${i}: "${text}"`)
})

console.log('\n=== Antonyms (.opn) ===')
firstIji.find('.opn').slice(0, 3).each((i, el) => {
  const text = $(el).text().trim()
  console.log(`  ${i}: "${text}"`)
})

console.log('\n=== Quotes (.t6l) ===')
const quotes = $('.t6l').first()
console.log('Found:', quotes.length)
quotes.find('> .uoh > div').first().children().each((i, el) => {
  const tag = el.name
  const cls = $(el).attr('class') || '(no class)'
  const text = $(el).text().substring(0, 60)
  console.log(`  ${i}: <${tag} class="${cls}"> "${text}..."`)
})

