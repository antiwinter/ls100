import { MDX } from 'js-mdict'

const mdx = new MDX('/Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx')
const words = ['accoutrement', 'adage', 'ado']

for (const word of words) {
  const result = mdx.lookup(word)
  if (!result) continue
  
  const html = result.definition
  const labelMatches = html.match(/【[^】]*标签】[：:][^【]*/g)
  
  console.log(`\n=== ${word} ===`)
  if (labelMatches) {
    console.log('Found labels:')
    labelMatches.forEach(m => console.log('  ', m))
  } else {
    console.log('No labels found')
  }
}

