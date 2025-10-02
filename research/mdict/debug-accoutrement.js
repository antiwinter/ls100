import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'

const mdx = new MDX('/Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx')
const result = mdx.lookup('accoutrement')
const $ = cheerio.load(result.definition)

console.log('=== Full HTML ===')
console.log(result.definition)
console.log()

console.log('=== Caption structure ===')
const caption = $('div.collins_en_cn .caption').first()
console.log('Caption text:', caption.text().substring(0, 200))
console.log()
console.log('Caption HTML:')
console.log(caption.html())

