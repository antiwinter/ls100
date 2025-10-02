import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const mdx = new MDX(path.join(__dirname, 'Collins-Advanced-ECE.mdx'))
const result = mdx.lookup('-ability')
const $ = cheerio.load(result.definition)

// Look for classes
console.log('Has .collins_en_cn:', $('.collins_en_cn').length)
console.log('Has .caption:', $('.caption').length)
console.log('Has .st:', $('.st').length)
console.log()

// Show structure
console.log('Structure of .collins_en_cn:')
$('.collins_en_cn').first().find('> *').each((i, el) => {
  console.log('  -', el.tagName, $(el).attr('class'))
  
  if ($(el).hasClass('caption')) {
    $(el).find('> *').each((j, child) => {
      console.log('    -', child.tagName, $(child).attr('class'), ':', $(child).text().substring(0, 30))
    })
  }
})

console.log('\nText content:')
console.log($('.st').first().text())
console.log($('.text_blue').first().text())

