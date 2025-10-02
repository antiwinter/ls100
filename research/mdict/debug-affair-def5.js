import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'

const mdx = new MDX('/Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx')
const result = mdx.lookup('affair')
const $ = cheerio.load(result.definition)

console.log('=== affair definition 5 & 6 (the "See also" ones) ===\n')

const block5 = $('div.collins_en_cn').eq(4)
console.log('Definition 5:')
console.log($.html(block5))
console.log()

const block6 = $('div.collins_en_cn').eq(5)
console.log('Definition 6:')
console.log($.html(block6))

