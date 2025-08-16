import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { log } from '../../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ARPABET to IPA mapping table
// Based on CMU ARPABET phoneme set
const ARPABET_TO_IPA = {
  // Vowels
  'AA': 'ɑː',   // father
  'AE': 'æ',    // cat
  'AH': 'ə',    // about (schwa in unstressed), 'ʌ' when stressed
  'AO': 'ɔː',   // caught
  'AW': 'aʊ',   // cow
  'AY': 'aɪ',   // bite
  'EH': 'e',    // bed (changed from ɛ to e)
  'ER': 'ɜːr',  // bird (added r)
  'EY': 'eɪ',   // bait
  'IH': 'ɪ',    // bit
  'IY': 'iː',   // beat
  'OW': 'oʊ',   // boat
  'OY': 'ɔɪ',   // boy
  'UH': 'ʊ',    // book
  'UW': 'uː',   // boot
  
  // Consonants
  'B': 'b',     // be
  'CH': 'ʧ',    // cheese
  'D': 'd',     // dee
  'DH': 'ð',    // thee
  'F': 'f',     // fee
  'G': 'ɡ',     // green
  'HH': 'h',    // he
  'JH': 'ʤ',    // gee
  'K': 'k',     // key
  'L': 'l',     // lee
  'M': 'm',     // me
  'N': 'n',     // knee
  'NG': 'ŋ',    // ping
  'P': 'p',     // pee
  'R': 'r',     // read
  'S': 's',     // sea
  'SH': 'ʃ',    // she
  'T': 't',     // tea
  'TH': 'θ',    // theta
  'V': 'v',     // vee
  'W': 'w',     // we
  'Y': 'j',     // yield
  'Z': 'z',     // zee
  'ZH': 'ʒ'     // seizure
}

// In-memory dictionary storage
let pronunciationDict = new Map()

// Load CMU dictionary into memory
const loadCMUDict = () => {
  try {
    const dictPath = path.join(__dirname, 'cmudict.txt')
    if (!fs.existsSync(dictPath)) {
      log.warn('CMU dictionary file not found at:', dictPath)
      return false
    }

    const dictContent = fs.readFileSync(dictPath, 'utf8')
    const lines = dictContent.split('\n')
    
    let loadedCount = 0
    for (const line of lines) {
      if (line.trim() && !line.startsWith(';;;')) { // Skip comments
        const parts = line.trim().split(' ')
        if (parts.length >= 2) {
          const word = parts[0].toLowerCase()
          // Remove parentheses for alternate pronunciations like "hello(2)"
          const cleanWord = word.replace(/\(\d+\)$/, '')
          const arpabet = parts.slice(1)
          
          // Store ARPABET (we'll convert on demand)
          if (!pronunciationDict.has(cleanWord)) {
            pronunciationDict.set(cleanWord, arpabet)
            loadedCount++
          }
        }
      }
    }
    
    log.info(`CMU dictionary loaded: ${loadedCount} entries`)
    return true
  } catch (error) {
    log.error('Failed to load CMU dictionary:', error.message)
    return false
  }
}

// Convert ARPABET to IPA with systematic rules
const arpabetToIPA = (arpabetArray) => {
  if (!Array.isArray(arpabetArray)) return null
  
  // Count syllables to determine if monosyllabic
  const vowelCount = arpabetArray.filter(p => isVowel(p.replace(/[012]$/, ''))).length
  const isMonosyllabic = vowelCount <= 1
  
  let result = ''
  
  // Step 1: Convert phonemes with systematic rules
  for (let i = 0; i < arpabetArray.length; i++) {
    const phoneme = arpabetArray[i]
    const cleanPhoneme = phoneme.replace(/[012]$/, '')
    let ipaSymbol = ARPABET_TO_IPA[cleanPhoneme]
    
    if (!ipaSymbol) {
      log.warn(`Unknown ARPABET phoneme: ${phoneme}`)
      result += phoneme
      continue
    }
    
    // Apply systematic rules based on phoneme type and stress
    
    // Rule 1: Handle AH (schwa vs strut)
    if (cleanPhoneme === 'AH') {
      if (phoneme.endsWith('1') || phoneme.endsWith('2')) {
        ipaSymbol = 'ʌ' // Stressed AH = ʌ (like "cut")
      } else {
        // Special case: -tiful ending (T AH0 F AH0 L -> tɪfl, not təfəl)
        if (i >= 1 && arpabetArray[i-1] === 'T' && 
            i + 3 < arpabetArray.length && arpabetArray[i+1] === 'F' && 
            arpabetArray[i+2] === 'AH0' && arpabetArray[i+3] === 'L') {
          ipaSymbol = 'ɪ' // First AH in -tiful becomes ɪ
        }
        // Skip second AH in -tiful pattern completely  
        else if (i >= 3 && arpabetArray[i-3] === 'T' && arpabetArray[i-2] === 'AH0' && 
                 arpabetArray[i-1] === 'F' && i + 1 < arpabetArray.length && arpabetArray[i+1] === 'L') {
          continue // Skip this AH0 completely to get tɪfl instead of tɪfəl
        }
        // Regular unstressed AH -> schwa
        else {
          ipaSymbol = 'ə' // Regular unstressed AH = ə (schwa)
        }
      }
    }
    
    // Rule 2: Handle ER (rhotic vowels)
    if (cleanPhoneme === 'ER') {
      if (phoneme.endsWith('1') || phoneme.endsWith('2')) {
        ipaSymbol = 'ɜːr' // Stressed ER (like "world")
      } else {
        ipaSymbol = 'ər' // Unstressed ER (like "water", "computer")  
      }
    }
    
    // Rule 3: Handle unstressed high vowels in final position
    if (cleanPhoneme === 'IY' && phoneme.endsWith('0')) {
      ipaSymbol = 'i' // Unstressed IY = i (not iː)
    }
    
    result += ipaSymbol
  }
  
  // Step 2: Add stress marks based on systematic rules
  if (!isMonosyllabic) {
    result = addStressMarks(arpabetArray, result)
  }
  
  return result
}

// Systematic stress placement
const addStressMarks = (arpabetArray, ipaString) => {
  const stressPositions = []
  
  // Find all stress positions in ARPABET
  for (let i = 0; i < arpabetArray.length; i++) {
    const phoneme = arpabetArray[i]
    if (phoneme.endsWith('1')) {
      stressPositions.push({ arpabetIndex: i, type: 'primary', phoneme })
    } else if (phoneme.endsWith('2')) {
      stressPositions.push({ arpabetIndex: i, type: 'secondary', phoneme })
    }
  }
  
  // Check if we need to simplify stress pattern
  // If there's both secondary and primary stress, sometimes we only show primary
  const hasPrimary = stressPositions.some(s => s.type === 'primary')
  const hasSecondary = stressPositions.some(s => s.type === 'secondary')
  
  // Keep all stress marks as indicated by ARPABET
  // No artificial filtering - ARPABET stress information is authoritative
  
  if (stressPositions.length === 0) return ipaString
  
  // Build a mapping from ARPABET position to IPA position
  const arpabetToIpaMap = buildPositionMap(arpabetArray, ipaString)
  
  // Sort stress positions and insert marks (in reverse order to maintain positions)
  stressPositions.sort((a, b) => b.arpabetIndex - a.arpabetIndex)
  
  let result = ipaString
  
  for (const stress of stressPositions) {
    const mark = stress.type === 'primary' ? 'ˈ' : 'ˌ'
    const insertPos = findSyllableStart(arpabetArray, stress.arpabetIndex, arpabetToIpaMap)
    
    // Insert stress mark
    result = result.slice(0, insertPos) + mark + result.slice(insertPos)
  }
  
  return result
}

// Build mapping from ARPABET phoneme index to IPA character position
const buildPositionMap = (arpabetArray, ipaString) => {
  const map = []
  let ipaPos = 0
  
  for (let i = 0; i < arpabetArray.length; i++) {
    const phoneme = arpabetArray[i]
    const cleanPhoneme = phoneme.replace(/[012]$/, '')
    
    map[i] = ipaPos
    
    // Calculate how many IPA characters this ARPABET phoneme produces
    let ipaLength = 1
    if (cleanPhoneme === 'ER') {
      ipaLength = phoneme.endsWith('1') || phoneme.endsWith('2') ? 3 : 2 // ɜːr or ər
    } else if (['AA', 'AO', 'IY', 'UW', 'ER'].includes(cleanPhoneme)) {
      ipaLength = phoneme.endsWith('1') || phoneme.endsWith('2') ? 2 : 1 // ɑː vs ɑ
    }
    
    ipaPos += ipaLength
  }
  
  return map
}

// Find the start of the syllable containing the stressed vowel
const findSyllableStart = (arpabetArray, stressedVowelIndex, positionMap) => {
  // Skip semi-vowels (Y, W) when finding syllable boundaries
  // These don't form real syllable boundaries for stress placement
  const isSemiVowel = (phoneme) => ['Y', 'W'].includes(phoneme.replace(/[012]$/, ''))
  
  // Look backwards from stressed vowel to find true consonant boundary
  let i = stressedVowelIndex - 1
  
  // Skip semi-vowels immediately before the stressed vowel
  while (i >= 0 && isSemiVowel(arpabetArray[i])) {
    i--
  }
  
  // If we hit a vowel or start of word, place stress at current position
  if (i < 0 || isVowel(arpabetArray[i].replace(/[012]$/, ''))) {
    // No true consonant found, or hit previous vowel
    // Place stress at the beginning of the onset (including semi-vowels)
    let startIndex = stressedVowelIndex - 1
    while (startIndex >= 0 && !isVowel(arpabetArray[startIndex].replace(/[012]$/, ''))) {
      startIndex--
    }
    return positionMap[startIndex + 1] || 0
  }
  
  // Found a true consonant - this is where the syllable boundary should be
  // For single consonant: stress goes before it
  // For consonant clusters: need to apply splitting rules
  
  let consonantCluster = []
  let j = i
  
  // Collect all true consonants (non-vowels, non-semi-vowels) going backwards
  while (j >= 0) {
    const phoneme = arpabetArray[j].replace(/[012]$/, '')
    if (isVowel(phoneme)) {
      break // Hit previous vowel, stop
    }
    if (!isSemiVowel(arpabetArray[j])) {
      consonantCluster.unshift(j) // Add true consonants only
    }
    j--
  }
  
  if (consonantCluster.length === 0) {
    // No true consonants, place stress before onset
    return positionMap[stressedVowelIndex - 1] || 0
  }
  
  let syllableStartIndex
  
  if (consonantCluster.length === 1) {
    // Single true consonant - stress goes before it
    syllableStartIndex = consonantCluster[0]
  } else {
    // Multiple consonants - apply splitting rules
    // For now, simple rule: stress goes before the last consonant in cluster
    // This handles MP -> kə[m]ˈ[p]juː correctly
    syllableStartIndex = consonantCluster[consonantCluster.length - 1]
  }
  
  // Return IPA position for this syllable start
  return positionMap[syllableStartIndex] || 0
}

// Helper function to check if phoneme is a vowel
const isVowel = (phoneme) => {
  const vowels = ['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']
  return vowels.includes(phoneme)
}

// Lookup pronunciation for a word
export const lookupPronunciation = (word, format = 'ipa') => {
  if (!word || typeof word !== 'string') return null
  
  const cleanWord = word.toLowerCase().trim()
  const arpabet = pronunciationDict.get(cleanWord)
  
  if (!arpabet) return null
  
  if (format === 'arpabet') {
    return arpabet.join(' ')
  } else if (format === 'ipa') {
    return arpabetToIPA(arpabet)
  }
  
  return null
}

// Get available formats
export const getAvailableFormats = () => ['arpabet', 'ipa']

// Get dictionary stats
export const getDictStats = () => ({
  totalEntries: pronunciationDict.size,
  isLoaded: pronunciationDict.size > 0
})

// Initialize dictionary on module load
const initSuccess = loadCMUDict()
if (!initSuccess) {
  log.error('CMU phonetic dictionary initialization failed')
}

export default {
  lookupPronunciation,
  getAvailableFormats,
  getDictStats
}
