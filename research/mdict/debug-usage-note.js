import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'

const mdx = new MDX('/Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx')
const result = mdx.lookup('aboard')
const $ = cheerio.load(result.definition)

console.log('=== aboard usage note structure ===\n')
$('li.en_tip').each((idx, el) => {
  console.log(`Usage note ${idx + 1}:`)
  console.log($.html(el))
  console.log()
})

