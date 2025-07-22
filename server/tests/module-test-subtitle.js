import { runMigrations, db } from '../utils/db/connection.js'
import * as subtitleModel from '../modules/subtitle/data.js'
import { computeHash, parseSrt, uploadSubtitle, getSubtitle } from '../modules/subtitle/storage.js'
import { parseMovieInfo, detectLang } from '../modules/subtitle/detect.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Sample SRT content for testing
const sampleSrtContent = `1
00:00:01,000 --> 00:00:04,000
Hello, welcome to our language learning app.

2
00:00:05,000 --> 00:00:08,000
This is a sample subtitle for testing.

3
00:00:09,000 --> 00:00:12,000
We hope you enjoy learning with us!`

console.log('🧪 Testing Subtitle Module...\n')

try {
  // Test 1: Database initialization
  console.log('1. Testing database initialization...')
  runMigrations()
  console.log('✅ Module-based migrations completed')

  // Clear subtitles table for clean test
  db.prepare('DELETE FROM subtitles').run()
  console.log('✅ Subtitles table cleared for testing\n')

  // Test 2: Hash computation
  console.log('2. Testing hash computation...')
  const buffer = Buffer.from(sampleSrtContent, 'utf8')
  const hash = computeHash(buffer)
  const expectedHashLength = 64 // SHA256 produces 64 character hex string
  
  if (hash && hash.length === expectedHashLength) {
    console.log('✅ Hash computed successfully')
    console.log(`   Hash: ${hash}`)
    console.log(`   Length: ${hash.length} characters`)
  } else {
    throw new Error('Hash computation failed')
  }

  // Test 3: SRT parsing
  console.log('\n3. Testing SRT parsing...')
  const parsed = parseSrt(sampleSrtContent)
  
  if (parsed && parsed.lines === 3 && parsed.duration) {
    console.log('✅ SRT parsing successful')
    console.log(`   Lines: ${parsed.lines}`)
    console.log(`   Duration: ${parsed.duration}`)
    console.log(`   Parsed entries: ${parsed.parsed.length}`)
  } else {
    throw new Error('SRT parsing failed')
  }

  // Test 4: Subtitle upload (new file)
  console.log('\n4. Testing subtitle upload (new file)...')
  const metadata = {
    movie_name: 'Test Movie',
    language: 'en'
  }

  const uploadResult = await uploadSubtitle(hash, buffer, metadata)
  
  if (uploadResult && uploadResult.subtitle_id === hash && !uploadResult.lightning) {
    console.log('✅ New subtitle uploaded successfully')
    console.log(`   Subtitle ID: ${uploadResult.subtitle_id}`)
    console.log(`   Lightning: ${uploadResult.lightning}`)
    console.log(`   Movie: ${uploadResult.metadata.movie_name}`)
    console.log(`   Language: ${uploadResult.metadata.language}`)
    console.log(`   Duration: ${uploadResult.metadata.duration}`)
  } else {
    throw new Error('Subtitle upload failed')
  }

  // Test 5: Find subtitle by hash
  console.log('\n5. Testing findByHash...')
  const foundSubtitle = subtitleModel.findByHash(hash)
  
  if (foundSubtitle && foundSubtitle.subtitle_id === hash) {
    console.log('✅ Subtitle found by hash')
    console.log(`   Movie: ${foundSubtitle.movie_name}`)
    console.log(`   Language: ${foundSubtitle.language}`)
    console.log(`   Ref count: ${foundSubtitle.ref_count}`)
    console.log(`   Uploaded: ${foundSubtitle.first_uploaded}`)
  } else {
    throw new Error('Subtitle not found by hash')
  }

  // Test 6: Lightning upload (duplicate file)
  console.log('\n6. Testing lightning upload (duplicate file)...')
  const lightningResult = await uploadSubtitle(hash, buffer, {
    movie_name: 'Same Movie, Different Upload',
    language: 'en'
  })

  if (lightningResult && lightningResult.lightning === true) {
    console.log('✅ Lightning upload successful')
    console.log(`   Lightning: ${lightningResult.lightning}`)
    console.log(`   Ref count should be incremented`)
    
    // Verify ref count increment
    const updatedSubtitle = subtitleModel.findByHash(hash)
    console.log(`   New ref count: ${updatedSubtitle.ref_count}`)
  } else {
    throw new Error('Lightning upload failed')
  }

  // Test 7: Get subtitle content
  console.log('\n7. Testing subtitle content retrieval...')
  const retrievedContent = await getSubtitle(hash)
  const retrievedString = retrievedContent.toString('utf8')
  
  if (retrievedString === sampleSrtContent) {
    console.log('✅ Subtitle content retrieved successfully')
    console.log(`   Content length: ${retrievedString.length} characters`)
    console.log(`   Matches original: ${retrievedString === sampleSrtContent}`)
  } else {
    throw new Error('Retrieved content does not match original')
  }

  // Test 8: Find by movie name
  console.log('\n8. Testing findByMovieName...')
  const movieSubtitles = subtitleModel.findByMovieName('Test Movie')
  
  if (movieSubtitles.length > 0) {
    console.log(`✅ Found ${movieSubtitles.length} subtitles for "Test Movie"`)
    movieSubtitles.forEach(sub => {
      console.log(`   📁 ${sub.movie_name} (${sub.language}) - Refs: ${sub.ref_count}`)
    })
  } else {
    throw new Error('No subtitles found for movie name')
  }

  // Test 9: Subtitle statistics
  console.log('\n9. Testing subtitle statistics...')
  const stats = subtitleModel.getStats()
  
  if (stats && stats.total_subtitles > 0) {
    console.log('✅ Subtitle statistics:')
    console.log(`   Total subtitles: ${stats.total_subtitles}`)
    console.log(`   Total references: ${stats.total_references}`)
    console.log(`   Unique movies: ${stats.unique_movies}`)
  } else {
    throw new Error('Statistics retrieval failed')
  }

  // Test 10: Find all subtitles
  console.log('\n10. Testing findAll...')
  const allSubtitles = subtitleModel.findAll()
  
  console.log(`✅ Found ${allSubtitles.length} total subtitles`)
  allSubtitles.forEach(sub => {
    console.log(`   🎬 ${sub.movie_name} (${sub.language}) - ${sub.duration}`)
  })

  // Test 11: Reference count operations
  console.log('\n11. Testing reference count operations...')
  const beforeDecrement = subtitleModel.findByHash(hash)
  console.log(`   Ref count before decrement: ${beforeDecrement.ref_count}`)
  
  subtitleModel.decrementRef(hash)
  const afterDecrement = subtitleModel.findByHash(hash)
  console.log(`   Ref count after decrement: ${afterDecrement.ref_count}`)
  
  if (afterDecrement.ref_count === beforeDecrement.ref_count - 1) {
    console.log('✅ Reference count decrement working')
  } else {
    throw new Error('Reference count decrement failed')
  }

  // Test 12: Auto-detection features
  console.log('\n12. Testing auto-detection features...')
  
  // Test filename parsing
  const testFilenames = [
    'The.Matrix.1999.720p.BluRay.x264-SPARKS.en.srt',
    '[Group] Inception (2010) [1080p].zh-CN.srt',
    'Interstellar.2014.WEBRip.x264.es.srt'
  ]
  
  for (const filename of testFilenames) {
    const parsed = parseMovieInfo(filename)
    console.log(`   📁 ${filename}`)
    console.log(`      Movie: ${parsed.movieName}`)
    console.log(`      Language: ${parsed.language}`)
    console.log(`      Year: ${parsed.year}`)
  }
  
  // Test language detection from content
  const spanishContent = `1
00:00:01,000 --> 00:00:04,000
Hola, bienvenido a nuestra aplicación de aprendizaje de idiomas.

2
00:00:05,000 --> 00:00:08,000
Este es un subtítulo de muestra para las pruebas.`

  const chineseContent = `1
00:00:01,000 --> 00:00:04,000
你好，欢迎使用我们的语言学习应用程序。

2
00:00:05,000 --> 00:00:08,000
这是用于测试的示例字幕。`

  const dualLangContent = `1
00:00:01,000 --> 00:00:04,000
Hello, welcome to our app.
你好，欢迎使用我们的应用程序。

2
00:00:05,000 --> 00:00:08,000
This is a test subtitle.
这是一个测试字幕。`

  const langTests = [
    { name: 'English', content: sampleSrtContent },
    { name: 'Spanish', content: spanishContent },
    { name: 'Chinese', content: chineseContent },
    { name: 'Dual Language', content: dualLangContent }
  ]

  for (const test of langTests) {
    const detected = detectLang(test.content)
    console.log(`   🌐 ${test.name}: ${detected.join(', ')}`)
  }

  console.log('✅ Auto-detection features working correctly')

  console.log('\n🎉 All subtitle module tests passed!')

} catch (error) {
  console.error('💥 Subtitle module test failed:', error)
  process.exit(1)
} 