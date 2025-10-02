/**
 * Collins 2015 Edition Parser
 * 
 * Parses "Collins English Dictionary and Thesaurus, 2015"
 * Outputs extended JSON format with ipa, origin, quotes, thesaurus
 */

export class Collins2015Parser {
  constructor(word) {
    this.word = word
    this.result = {
      word,
      ipa: '',
      defs: [],
      thesaurus: {},
      origin: '',
      quotes: [],
      refTo: []
    }
    
    // Parser state
    this.state = 'INIT'
    this.stateStack = []
    
    // Current working data
    this.currentPOS = null
    this.currentDef = null
    this.currentThesaurusPOS = null
    this.currentThesaurusGroup = null
    this.currentQuote = null
    
    // Text accumulation
    this.textBuffer = []
    this.exampleBuffer = []
    this.ipaBuffer = []
    
    // Path tracking
    this.path = []
    
    // Unknown patterns
    this.unknownPatterns = []
  }
  
  startElement(tag, classes, attrs, path) {
    this.path = path
    const classStr = classes.join('.')
    const selector = classes.length > 0 ? `${tag}.${classStr}` : tag
    
    // State transitions
    switch (this.state) {
      case 'INIT':
        if (tag === 'html' || tag === 'body') {
          this.pushState('IN_BODY')
        } else if (tag === 'link' || tag === 'head' || tag === 'meta' || tag === 'script') {
          // Ignore metadata
        } else {
          this.reportUnknown('INIT', selector, path)
        }
        break
        
      case 'IN_BODY':
        if (tag === 'div' && (classes.includes('c1a') || attrs.id)) {
          this.pushState('IN_ROOT')
        } else if (tag === 'div' && classes.includes('dxr')) {
          // Simple structure: .dxr directly at body level (no .c1a tabs)
          this.pushState('IN_ROOT')
          this.pushState('IN_DICT_CONTAINER')
        } else if (tag === 'link' || tag === 'head' || tag === 'meta' || tag === 'script') {
          // Ignore metadata
        } else {
          this.reportUnknown('IN_BODY', selector, path)
        }
        break
        
      case 'IN_ROOT':
        // Check for tabs and content sections
        if (classes.includes('fvv')) {
          // Tabs, skip
        } else if (classes.includes('dxr')) {
          // Dictionary section
          this.pushState('IN_DICT_CONTAINER')
        } else if (classes.includes('tvr')) {
          // Thesaurus section  
          this.pushState('IN_THES_CONTAINER')
        } else if (classes.includes('exq') || classes.includes('t6l')) {
          this.pushState('IN_QUOTES_SECTION')
        } else if (tag === 'div' || tag === 'script' || tag === 'a') {
          // Wrapper divs, scripts, links - stay in state
        } else {
          this.reportUnknown('IN_ROOT', selector, path)
        }
        break
        
      case 'IN_DICT_CONTAINER':
        if (classes.includes('j84')) {
          this.pushState('IN_DICT_ENTRY')
        } else if (tag === 'div' || tag === 'a') {
          // Wrappers
        } else {
          this.reportUnknown('IN_DICT_CONTAINER', selector, path)
        }
        break
        
      case 'IN_THES_CONTAINER':
        if (classes.includes('j84')) {
          this.pushState('IN_THES_ENTRY')
        } else if (tag === 'div' || tag === 'a') {
          // Wrappers
        } else {
          this.reportUnknown('IN_THES_CONTAINER', selector, path)
        }
        break
        
      case 'IN_TABS':
        // Just consume tab elements
        break
        
      case 'IN_DICT_ENTRY':
        if (classes.includes('f9d') || classes.includes('quf')) {
          this.pushState('IN_HEADWORD')
        } else if (classes.includes('mh1')) {
          this.pushState('IN_DICT_MAIN')
        } else if (classes.includes('roj')) {
          this.pushState('IN_ORIGIN')
        } else if (classes.includes('sbt')) {
          // Derived forms section, skip for now
        } else if (tag === 'a' || tag === 'img' || (tag === 'div' && (classes.includes('ig6') || !classes.length))) {
          // Links, icons, wrappers
        } else {
          this.reportUnknown('IN_DICT_ENTRY', selector, path)
        }
        break
        
      case 'IN_HEADWORD':
        if (classes.includes('kf5')) {
          this.pushState('IN_IPA')
        } else if (tag === 'img') {
          // Ignore speaker icons
        }
        break
        
      case 'IN_IPA':
        // Collect IPA text, ignore nested images
        if (tag === 'img') {
          // Ignore speaker icons
        }
        break
        
      case 'IN_DICT_MAIN':
        if (classes.includes('x5z')) {
          this.startPOS()
          this.pushState('IN_POS_SECTION')
        } else if (classes.includes('roj')) {
          // Origin section
          this.pushState('IN_ORIGIN')
        } else if (classes.includes('sbt')) {
          // Derived forms, skip
        } else if (tag === 'div' || tag === 'h3' || tag === 'h4' || tag === 'span' || tag === 'p' || tag === 'cite' || tag === 'em' || tag === 'img') {
          // Various wrappers and inline elements - stay in state
        } else {
          this.reportUnknown('IN_DICT_MAIN', selector, path)
        }
        break
        
      case 'IN_POS_SECTION':
        if (classes.includes('yeq') || classes.includes('jnw') || classes.includes('jgs')) {
          this.pushState('IN_POS_HEADER')
        } else if (classes.includes('oyu') || classes.includes('o8h')) {
          this.pushState('IN_DEFS')
        } else if (tag === 'h2' || tag === 'div') {
          // Headers/wrappers
        } else {
          this.reportUnknown('IN_POS_SECTION', selector, path)
        }
        break
        
      case 'IN_POS_HEADER':
        // Collect POS text
        break
        
      case 'IN_DEFS':
        if (classes.includes('iji') || classes.includes('lij')) {
          this.startDefinition()
          this.pushState('IN_DEF')
        } else {
          this.reportUnknown('IN_DEFS', selector, path)
        }
        break
        
      case 'IN_DEF':
        if (classes.includes('sd9')) {
          this.pushState('IN_DEF_TEXT')
        } else if (classes.includes('u9w')) {
          this.pushState('IN_EXAMPLE')
        } else if (classes.includes('k75') || tag === 'q' || tag === 'span' || tag === 'div' || tag === 'em') {
          // Arrows, quotes, inline elements, wrappers - stay in state
        } else {
          this.reportUnknown('IN_DEF', selector, path)
        }
        break
        
      case 'IN_DEF_TEXT':
        // Collect text
        break
        
      case 'IN_EXAMPLE':
        // Allow nested tags like q for quotes
        if (tag === 'q' || tag === 'span' || tag === 'em') {
          // Just collect text, don't change state
        }
        break
        
      case 'IN_ORIGIN':
        // Collect text
        break
        
      case 'IN_THES_ENTRY':
        if (classes.includes('f9d')) {
          // Headword in thesaurus, skip
        } else if (classes.includes('klp')) {
          this.pushState('IN_THES_MAIN')
        } else if (tag === 'a' || tag === 'div') {
          // Links/wrappers
        } else {
          this.reportUnknown('IN_THES_ENTRY', selector, path)
        }
        break
        
      case 'IN_THES_MAIN':
        if (classes.includes('x5z')) {
          this.startThesaurusPOS()
          this.pushState('IN_THES_POS_SECTION')
        } else {
          this.reportUnknown('IN_THES_MAIN', selector, path)
        }
        break
        
      case 'IN_THES_POS_SECTION':
        if (classes.includes('yeq')) {
          this.pushState('IN_THES_POS_HEADER')
        } else if (classes.includes('oyu')) {
          this.pushState('IN_THES_GROUPS')
        } else if (tag === 'h2' || tag === 'div') {
          // Headers/wrappers
        } else {
          this.reportUnknown('IN_THES_POS_SECTION', selector, path)
        }
        break
        
      case 'IN_THES_POS_HEADER':
        // Collect POS
        break
        
      case 'IN_THES_GROUPS':
        if (classes.includes('iji')) {
          this.startThesaurusGroup()
          this.pushState('IN_THES_GROUP')
        } else {
          this.reportUnknown('IN_THES_GROUPS', selector, path)
        }
        break
        
      case 'IN_THES_GROUP':
        if (classes.includes('bbw')) {
          // = marker, skip
          this.textBuffer = []
        } else if (classes.includes('fxr')) {
          this.pushState('IN_SYNONYM')
        } else if (tag === 'span' || tag === 'a' || (tag === 'div' && !classes.length)) {
          // Check for 'opp' marker in text for antonyms
        } else {
          this.reportUnknown('IN_THES_GROUP', selector, path)
        }
        break
        
      case 'IN_SYNONYM':
        if (classes.includes('xf7')) {
          // Synonym wrapper
        }
        break
        
      case 'IN_QUOTES_SECTION':
        if (tag === 'h3' || tag === 'div' || tag === 'q' || tag === 'cite' || tag === 'span' || tag === 'img' || tag === 'br') {
          // Quotation structure - for now, just collect all text
        }
        break
    }
  }
  
  text(content) {
    const trimmed = content.trim()
    if (!trimmed) return
    
    // Use separate buffers for different contexts
    if (this.state === 'IN_EXAMPLE') {
      this.exampleBuffer.push(trimmed)
    } else if (this.state === 'IN_IPA') {
      this.ipaBuffer.push(trimmed)
    } else {
      this.textBuffer.push(trimmed)
    }
  }
  
  endElement(tag, classes) {
    // Check for major container closings first - pop back to root
    if (classes.includes('dxr')) {
      // Closing dictionary section - pop back to IN_ROOT
      while (this.state !== 'IN_ROOT' && this.state !== 'INIT') {
        this.popState()
      }
      if (this.state === 'IN_ROOT') return
    }
    if (classes.includes('tvr')) {
      // Closing thesaurus section - pop back to IN_ROOT
      while (this.state !== 'IN_ROOT' && this.state !== 'INIT') {
        this.popState()
      }
      if (this.state === 'IN_ROOT') return
    }
    
    const text = this.textBuffer.join(' ').trim()
    this.textBuffer = []
    
    switch (this.state) {
      case 'IN_HEADWORD':
        // Only set if not already set (dictionary wins over thesaurus)
        if (text && !this.result.word) {
          this.result.word = text
        }
        this.popState()
        break
        
      case 'IN_IPA':
        if (classes.includes('kf5')) {
          const ipaText = this.ipaBuffer.join(' ').trim()
          if (process.env.DEBUG_PARSER) {
            console.log(`  [IPA] Closing .kf5. ipaBuffer="${ipaText}"`)
          }
          if (ipaText) {
            // Append to existing IPA (for multiple pronunciations)
            if (this.result.ipa) {
              this.result.ipa += ' ' + ipaText
            } else {
              this.result.ipa = ipaText
            }
            if (process.env.DEBUG_PARSER) {
              console.log(`  [IPA] ✓ Set IPA: "${this.result.ipa}"`)
            }
          }
          this.ipaBuffer = []
          this.popState()
        }
        break
        
      case 'IN_POS_HEADER':
        if (text) {
          this.currentPOS = text.toLowerCase()
        }
        this.popState()
        break
        
      case 'IN_DEF_TEXT':
        if (text && this.currentDef) {
          this.currentDef.en = text
        }
        this.popState()
        break
        
      case 'IN_EXAMPLE':
        // Only pop when closing the .u9w element
        if (classes.includes('u9w')) {
          const exampleText = this.exampleBuffer.join(' ')
          if (exampleText && this.currentDef) {
            this.currentDef.exs.push({ en: exampleText })
            if (process.env.DEBUG_PARSER) {
              console.log(`  [EX] Added example: "${exampleText.substring(0, 40)}..."`)
            }
          }
          this.exampleBuffer = []
          this.popState()
        }
        break
        
      case 'IN_DEF':
        // Only finish and pop when closing the .iji or .lij container
        if (classes.includes('iji') || classes.includes('lij')) {
          this.finishDefinition()
          this.popState()
        }
        break
      
      case 'IN_DEFS':
        // Only pop when closing the .oyu or .o8h container
        if (classes.includes('oyu') || classes.includes('o8h')) {
          this.popState()
        }
        break
        
      case 'IN_POS_SECTION':
        // Only pop when closing the .x5z container itself
        if (classes.includes('x5z')) {
          this.finishPOS()
          this.popState()
        }
        break
        
      case 'IN_ORIGIN':
        if (text) {
          this.result.origin = text
        }
        this.popState()
        break
        
      case 'IN_THES_POS_HEADER':
        if (text) {
          this.currentThesaurusPOS = text
        }
        this.popState()
        break
        
      case 'IN_SYNONYM':
        if (text && this.currentThesaurusGroup) {
          // Check if this is part of 'opp' (antonym) section
          const fullText = this.path.map(p => p.text || '').join(' ')
          if (fullText.includes('opp ')) {
            // This is an antonym
            this.currentThesaurusGroup.anto.push(text)
          } else {
            // This is a synonym
            this.currentThesaurusGroup.syno.push(text)
          }
        }
        this.popState()
        break
        
      case 'IN_THES_GROUP':
        // Check for 'opp' marker in accumulated text
        if (text) {
          // Split by 'opp' to separate synonyms from antonyms
          const parts = text.split(/\bopp\b/)
          if (parts.length > 1) {
            // Has antonyms
            const antonymText = parts[1]
            // Extract words (simplistic approach)
            const anto = antonymText.match(/\b[a-z]+(?:\s+[a-z]+)*\b/gi) || []
            this.currentThesaurusGroup.anto.push(...anto)
          }
        }
        this.finishThesaurusGroup()
        this.popState()
        break
        
      case 'IN_THES_GROUPS':
        this.popState()
        break
        
      case 'IN_THES_POS_SECTION':
        this.finishThesaurusPOS()
        this.popState()
        break
        
      case 'IN_QUOTES_SECTION':
        // For now, just store raw text as one quote
        if (text && text.length > 20) {
          this.result.quotes.push({ text })
        }
        this.popState()
        break
        
      case 'IN_TABS':
        this.popState()
        break
        
      case 'IN_DICT_ENTRY':
      case 'IN_THES_ENTRY':
        if (classes.includes('j84')) {
          this.popState()
        }
        break
        
      case 'IN_DICT_CONTAINER':
      case 'IN_THES_CONTAINER':
        if (classes.includes('dxr') || classes.includes('tvr')) {
          this.popState()
        }
        break
        
      case 'IN_BODY':
      case 'IN_ROOT':
        // Don't pop on element end, only when closing the root
        if (tag === 'body' || (tag === 'div' && classes.includes('c1a'))) {
          this.popState()
        }
        break
    }
  }
  
  // State management
  pushState(newState) {
    this.stateStack.push(this.state)
    const oldState = this.state
    this.state = newState
    if (process.env.DEBUG_PARSER) {
      console.log(`  [STATE] ${oldState} → ${newState}`)
    }
  }
  
  popState() {
    const oldState = this.state
    this.state = this.stateStack.pop() || 'INIT'
    if (process.env.DEBUG_PARSER) {
      console.log(`  [STATE] ${oldState} ← ${this.state}`)
    }
  }
  
  // Definition management
  startPOS() {
    this.currentPOS = ''
  }
  
  finishPOS() {
    this.currentPOS = null
  }
  
  startDefinition() {
    this.currentDef = {
      pos: this.currentPOS || '',
      en: '',
      exs: []
    }
    if (process.env.DEBUG_PARSER) {
      console.log(`  [DEF] Starting definition with POS: ${this.currentPOS}`)
    }
  }
  
  finishDefinition() {
    if (process.env.DEBUG_PARSER) {
      console.log(`  [DEF] Finishing def. Has en: ${!!this.currentDef?.en}, Text: "${this.currentDef?.en?.substring(0, 50)}"`)
    }
    if (this.currentDef && this.currentDef.en) {
      this.result.defs.push(this.currentDef)
      if (process.env.DEBUG_PARSER) {
        console.log(`  [DEF] ✓ Added definition. Total: ${this.result.defs.length}`)
      }
    }
    this.currentDef = null
  }
  
  // Thesaurus management
  startThesaurusPOS() {
    this.currentThesaurusPOS = ''
  }
  
  finishThesaurusPOS() {
    this.currentThesaurusPOS = null
  }
  
  startThesaurusGroup() {
    this.currentThesaurusGroup = {
      syno: [],
      anto: []
    }
  }
  
  finishThesaurusGroup() {
    if (this.currentThesaurusGroup && (this.currentThesaurusGroup.syno.length > 0 || this.currentThesaurusGroup.anto.length > 0)) {
      const pos = this.currentThesaurusPOS || 'unknown'
      if (!this.result.thesaurus[pos]) {
        this.result.thesaurus[pos] = []
      }
      this.result.thesaurus[pos].push(this.currentThesaurusGroup)
    }
    this.currentThesaurusGroup = null
  }
  
  // Unknown pattern tracking
  reportUnknown(state, selector, path) {
    this.unknownPatterns.push({
      state,
      selector,
      path: path.join(' > ')
    })
  }
  
  // Finish parsing
  finish() {
    // Close any open structures
    if (this.currentDef) this.finishDefinition()
    if (this.currentThesaurusGroup) this.finishThesaurusGroup()
    
    // Clean up empty fields
    if (Object.keys(this.result.thesaurus).length === 0) {
      delete this.result.thesaurus
    }
    if (this.result.quotes.length === 0) {
      delete this.result.quotes
    }
    if (!this.result.ipa) {
      delete this.result.ipa
    }
    if (!this.result.origin) {
      delete this.result.origin
    }
    if (this.result.refTo.length === 0) {
      delete this.result.refTo
    }
    
    return {
      result: this.result,
      unknownPatterns: this.unknownPatterns
    }
  }
}
