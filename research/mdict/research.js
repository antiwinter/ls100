import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { MDX, MDD } from 'js-mdict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.join(__dirname, '1')

// Find all dictionary files
const allFiles = fs.readdirSync(__dirname)
const mdxFiles = allFiles.filter(f => f.endsWith('.mdx'))
const mddFiles = allFiles.filter(f => f.endsWith('.mdd'))

console.log('🔬 Starting Collins dictionaries research...\n')
console.log(`Found ${mdxFiles.length} MDX files and ${mddFiles.length} MDD files\n`)

// Create base output directory
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const results = []

// Process each MDX file
for (const mdxFile of mdxFiles) {
  const dictName = mdxFile.replace('.mdx', '')
  const safeDictName = dictName.replace(/[^a-zA-Z0-9-]/g, '_')
  
  console.log('━'.repeat(60))
  console.log(`📖 Processing: ${dictName}`)
  console.log('━'.repeat(60))
  
  const dictOutputDir = path.join(OUTPUT_DIR, safeDictName)
  const mdxOutputDir = path.join(dictOutputDir, 'mdx')
  const mddOutputDir = path.join(dictOutputDir, 'mdd')
  
  fs.mkdirSync(mdxOutputDir, { recursive: true })
  fs.mkdirSync(mddOutputDir, { recursive: true })
  
  const result = {
    name: dictName,
    mdxEntries: 0,
    mddResources: 0,
    mdxSamples: 0,
    mddExtracted: 0
  }
  
  // ============= Extract MDX entries =============
  try {
    console.log('📖 Loading MDX file...')
    const mdxPath = path.join(__dirname, mdxFile)
    const mdx = new MDX(mdxPath)
    console.log('✅ MDX loaded\n')
    
    console.log('📝 Extracting MDX entries...')
    const keywordList = mdx.keywordList || []
    result.mdxEntries = keywordList.length
    console.log(`Found ${keywordList.length} MDX entries\n`)
    
    // Extract all keyword texts
    const allKeywords = keywordList.map(item => item.keyText).filter(Boolean)
    
    // Save a sample of entries for review
    const sampleSize = Math.min(100, allKeywords.length)
    console.log(`💾 Saving first ${sampleSize} entries as samples...`)
    
    for (let i = 0; i < sampleSize; i++) {
      const entry = allKeywords[i]
      try {
        const def = mdx.lookup(entry)
        if (def && def.definition) {
          const filename = entry.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
          const filepath = path.join(mdxOutputDir, `${String(i).padStart(4, '0')}_${filename}.html`)
          fs.writeFileSync(filepath, def.definition, 'utf8')
          result.mdxSamples++
        }
      } catch (e) {
        console.warn(`  Failed to lookup ${entry}: ${e.message}`)
      }
      if ((i + 1) % 50 === 0) {
        console.log(`  Saved ${i + 1}/${sampleSize} entries`)
      }
    }
    
    // Save full entry list
    const entryListPath = path.join(mdxOutputDir, '_all_entries.txt')
    fs.writeFileSync(entryListPath, allKeywords.join('\n'), 'utf8')
    console.log(`✅ Saved ${result.mdxSamples} samples and full entry list\n`)
  } catch (error) {
    console.error(`❌ Failed to process MDX: ${error.message}\n`)
  }
  
  // ============= Extract MDD resources =============
  const mddFile = mdxFile.replace('.mdx', '.mdd')
  const mddPath = path.join(__dirname, mddFile)
  
  if (!fs.existsSync(mddPath)) {
    console.log('⚠️  No MDD file found, skipping MDD extraction\n')
  } else {
    try {
      console.log('📦 Loading MDD file...')
      const mdd = new MDD(mddPath)
      console.log('✅ MDD loaded\n')
      
      console.log('🔍 Extracting MDD resources...')
      
      // Access the keyword list from the MDD object
      const mddKeywordList = mdd.keywordList || []
      result.mddResources = mddKeywordList.length
      console.log(`Found ${mddKeywordList.length} resources in MDD\n`)
      
      // Extract all resource keys
      const allResourceKeys = mddKeywordList.map(item => item.keyText).filter(Boolean)
      
      const maxResources = Math.min(allResourceKeys.length, 500) // Limit for now
      
      console.log(`💾 Extracting up to ${maxResources} resources...\n`)
      
      for (let i = 0; i < maxResources; i++) {
        const resourceKey = allResourceKeys[i]
        
        try {
          const resource = mdd.locate(resourceKey)
          if (resource && resource.definition) {
            const keyText = resource.keyText
            
            // Clean up filename
            let filename = keyText.replace(/^[\\\/]+/, '').replace(/[\\]/g, '/')
            const filepath = path.join(mddOutputDir, filename)
            
            // Create directory if needed
            const dir = path.dirname(filepath)
            fs.mkdirSync(dir, { recursive: true })
            
            // Decode base64 and save
            const buffer = Buffer.from(resource.definition, 'base64')
            fs.writeFileSync(filepath, buffer)
            result.mddExtracted++
            
            if (result.mddExtracted % 50 === 0) {
              console.log(`  Extracted ${result.mddExtracted} resources`)
            }
          }
        } catch (e) {
          console.warn(`  Failed to extract ${resourceKey}: ${e.message}`)
        }
      }
      
      console.log(`\n✅ Extracted ${result.mddExtracted} resources from MDD`)
      
      // Save resource list (all keys, not just extracted)
      const resourceListPath = path.join(mddOutputDir, '_all_resources.txt')
      fs.writeFileSync(resourceListPath, allResourceKeys.join('\n'), 'utf8')
      console.log(`✅ Saved resource list\n`)
    } catch (error) {
      console.error(`❌ Failed to process MDD: ${error.message}\n`)
    }
  }
  
  results.push(result)
}

// ============= Summary =============
console.log('\n')
console.log('━'.repeat(80))
console.log('📊 FINAL SUMMARY')
console.log('━'.repeat(80))
console.log(`📁 Output directory: ${OUTPUT_DIR}\n`)

for (const result of results) {
  console.log(`📖 ${result.name}`)
  console.log(`   MDX entries: ${result.mdxEntries.toLocaleString()} total (${result.mdxSamples} samples saved)`)
  if (result.mddResources > 0) {
    console.log(`   MDD resources: ${result.mddResources} total (${result.mddExtracted} extracted)`)
  } else {
    console.log(`   MDD resources: N/A`)
  }
  console.log()
}

console.log('━'.repeat(80))
console.log('✅ Research complete!\n')
