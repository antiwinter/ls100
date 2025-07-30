// Frontend language detection utility
// Note: This is a simplified version without franc dependency
// TODO: Add franc package or implement with different library

import { log } from './logger'


// Map language patterns to codes for basic detection
const LANGUAGE_PATTERNS = {
  en: [
    /\b(the|and|of|to|a|in|is|it|you|that|he|was|for|on|are|as|with|his|they|at|be|this|have|from|or|one|had|by|words|but|what|some|we|can|out|other|were|all|there|when|up|use|your|how|said|an|each|which|she|do|how|their|time|will|if|about|would|them|make|like|into|him|has|more|go|no|way|could|my|see|number|now|did|than|come|its|made|called|oil|sit|down|may)\b/gi,
    /\b(hello|world|english|language|movie|film|subtitle|speak|talk)\b/gi
  ],
  es: [
    /\b(el|la|de|que|y|a|en|un|es|se|no|te|lo|le|da|su|por|son|con|para|como|las|el|pero|sus|hay|del|al|todo|está|muy|fue|han|dos|hasta|antes|vez|cuando|donde|vida|tiempo|años|casa|pueblo|sobre|desde|sin|entre|porque|mucho|hace|más|bien|estar|ser|tener|hacer|poder|decir|poner|saber|ver|dar|venir|hablar|estar|ir|querer|llegar|pasar|trabajar|vivir|estudiar)\b/gi,
    /\b(hola|mundo|español|película|subtítulo|hablar|película)\b/gi
  ],
  fr: [
    /\b(le|de|et|à|un|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas|tout|plus|par|grand|quand|je|lui|mais|si|deux|mes|te|nos|ou|comme|avant|trop|dire|mot|any|jour|mettre|autre|bon|sous|peut|faire|petit|encore|terre|ici|bien|aller|part|prendre|eau|temps|main|chose|demander|problème|sembler|yeux|parler|donner|revenir|savoir|falloir|croire|laisser|porte|cœur|suite|mois|ami|village|emporter|vie|comprendre|blanc|compter|minute|jamais|poser|amour|non|monde|année|lettre|point|partir|livre|tenir|moyen|penser|enfant|côté|travail|fin|cours|chemin|fois|voir|tête|politique|courir|venir|chercher|obtenir|commencer|général|école|sentir|entre|rester|devenir|vers|intérieur|connaître|cependant|rendre|depuis|pourquoi|demander|homme|regarder|force|attendre|pouvoir|gouvernement|système|question|bureau|jouer|université|tuer|mot|sans|être|contre|tout|nouveau|savoir)\b/gi,
    /\b(bonjour|monde|français|film|sous-titre|parler)\b/gi
  ],
  zh: [
    /[\u4e00-\u9fff]+/g, // Chinese characters
    /\b(是|的|了|在|我|有|和|就|不|人|都|一|个|上|也|很|到|说|要|去|你|会|着|没|看|好|还|多|那|里|后|自|回|事|可|们|这|来|他|时|大|地|为|子|中|只|能|下|过|家|学|对|小|做|起|样|开|出|所|问|又|让|之|因|从|同|三|以|内|最|与|长|社|间|而|被|高|十|体|然|当|天|使|点|把|等|水|如|应|给|名|白|很|全|两|进|思|路|分|总|条|光|行|见|现|活|二|信|面|而|定|道|手|何|先|结|解|通|电|数|安|少|报|才|反|制|更|部|些|感|情|保|本|原|按|世|文|生|资|至|着|工|意|方|新|因|动|第|告|女|该|此|变|四|合|相|外|色|主|利|心|系|目|力|几|音|今|常|带|直|明|儿|位|以|立|程|关|加|己|必|特|难|论|及|员|机|华|无|产|五|南|题|往|北|经|通)\b/g
  ],
  ja: [
    /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, // Hiragana, Katakana, Kanji
    /\b(です|である|します|として|について|によって|によって|した|しない|する|される|させる|いる|ある|ない|行く|来る|見る|聞く|話す|読む|書く|食べる|飲む|買う|売る|作る|働く|学ぶ|教える|思う|知る|分かる|できる|いい|悪い|大きい|小さい|新しい|古い|高い|安い|美しい|汚い|暑い|寒い|楽しい|つまらない|おもしろい|難しい|簡単|忙しい|暇|私|あなた|彼|彼女|これ|それ|あれ|ここ|そこ|あそこ|今|昨日|明日|朝|昼|夜|時間|年|月|日|週|家|学校|会社|病院|駅|店|公園|映画|本|新聞|車|電車|バス|飛行機|コンピューター|テレビ|電話)\b/g
  ],
  ko: [
    /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]+/g, // Korean characters
    /\b(이다|있다|없다|하다|되다|가다|오다|보다|듣다|말하다|읽다|쓰다|먹다|마시다|사다|팔다|만들다|일하다|배우다|가르치다|생각하다|알다|모르다|좋다|나쁘다|크다|작다|새롭다|오래되다|비싸다|싸다|예쁘다|더럽다|덥다|춥다|재미있다|재미없다|어렵다|쉽다|바쁘다|한가하다|나|너|그|그녀|이것|그것|저것|여기|거기|저기|지금|어제|내일|아침|점심|저녁|시간|년|월|일|주|집|학교|회사|병원|역|가게|공원|영화|책|신문|차|기차|버스|비행기|컴퓨터|텔레비전|전화)\b/g
  ]
}

// Simple frequency-based language detection
export const detectLanguageFromContent = (content) => {
  const lines = content.split('\n')
  const textLines = lines.filter(line => 
    !line.match(/^\d+$/) &&                    // Not subtitle number
    !line.match(/\d{2}:\d{2}:\d{2}/) &&       // Not timestamp
    !line.match(/^-->\s*$/) &&                // Not arrow
    line.trim().length > 3                    // Has meaningful content
  )
  
  if (textLines.length === 0) return 'en'
  
  const langScores = {}
  const combinedText = textLines.join(' ').toLowerCase()
  
  // Score each language based on pattern matches
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    let score = 0
    let matchDetails = []
    for (const pattern of patterns) {
      const matches = combinedText.match(pattern) || []
      score += matches.length
      if (matches.length > 0) {
        matchDetails.push({ pattern: pattern.toString(), matches: matches.length })
      }
    }
    
    // Normalize by text length
    langScores= score / combinedText.length * 1000
    
    if (score > 0) {
      log.debug(`🔍 ${lang.toUpperCase()} score: ${langScores[lang].toFixed(2)} (${score} matches)`, matchDetails.slice(0, 2))
    }
  }
  
  // Return language with highest score, fallback to English
  const sortedLangs = Object.entries(langScores)
    .sort(([,a], [,b]) => b - a)
  
  log.debug('🔍 Language scores:', sortedLangs.slice(0, 3))
  
  const topLang = sortedLangs[0]?.[0]
  const result = topLang && langScores> 1 ? topLang : 'en'
  
  log.debug('🔍 Selected language:', result, `(top score: ${langScores[topLang]?.toFixed(2) || 'N/A'})`)
  
  return result
}

// Enhanced detection with confidence scoring
export const detectLanguageWithConfidence = (content) => {
  log.debug('🔍 Starting language detection for content length:', content.length)
  
  const detected = detectLanguageFromContent(content)
  
  // Simple confidence calculation based on detection
  const lines = content.split('\n')
  const textLines = lines.filter(line => 
    !line.match(/^\d+$/) && 
    !line.match(/\d{2}:\d{2}:\d{2}/) && 
    line.trim().length > 3
  )
  
  log.debug('🔍 Text analysis:', {
    totalLines: lines.length,
    textLines: textLines.length,
    detectedLanguage: detected,
    firstFewTextLines: textLines.slice(0, 3)
  })
  
  // Higher confidence for more text content
  const confidence = Math.min(0.9, Math.max(0.3, textLines.length / 100))
  
  const result = {
    language: detected,
    confidence,
    textLinesCount: textLines.length
  }
  
  log.debug('🔍 Final result:', result)
  
  return result
} 