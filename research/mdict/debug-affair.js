import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'

const mdx = new MDX('/Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx')
const result = mdx.lookup('affair')
const $ = cheerio.load(result.definition)

console.log('=== affair MDX structure ===\n')
console.log('Total collins_en_cn blocks:', $('div.collins_en_cn').length)
console.log()

$('div.collins_en_cn').each((idx, el) => {
  const num = $(el).find('.num').first().text().trim()
  const pos = $(el).find('.st').first().text().trim()
  const textBlue = $(el).find('.text_blue').first().text().trim()
  console.log(`${idx + 1}. ${num} ${pos} - ${textBlue.substring(0, 50)}`)
})

