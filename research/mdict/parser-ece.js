/**
 * Collins-Advanced-ECE Parser
 * 
 * State machine parser that receives DOM elements with hierarchy information
 * and builds structured JSON data.
 * 
 * Architecture:
 * - Receives events: startElement, text, endElement
 * - Maintains parsing state
 * - Recognizes known patterns, reports unknown ones
 * - Returns completed JSON structure
 */

export class ECEParser {
  constructor(word) {
    this.word = word
    this.result = {
      word,
      defs: [],
      refTo: []
    }
    
    // Parser state
    this.state = 'INIT'
    this.stateStack = []
    
    // Current working data
    this.currentDef = null
    this.currentEx = null
    this.currentUsageNote = null
    this.currentRefTo = null
    
    // Text accumulation
    this.textBuffer = []
    
    // Path tracking
    this.path = []
    
    // Unknown patterns
    this.unknownPatterns = []
  }
  
  startElement(tag, classes, attrs, path) {
    this.path = path
    const classStr = classes.join('.')
    const selector = classes.length > 0 ? `${tag}.${classStr}` : tag
    
    // State transitions based on element
    switch (this.state) {
      case 'INIT':
        if (classes.includes('collins_en_cn')) {
          this.pushState('IN_CONTENT')
        } else if (tag === 'font') {
          // Headword - ignore, we already have it
        } else if (tag === 'head' || tag === 'meta' || tag === 'link') {
          // Metadata - ignore
        } else if (tag === 'html' || tag === 'body') {
          // Document structure - ignore
        } else if (tag === 'div' && (classes.includes('tab_content') || classes.includes('part_main') || classes.includes('collins_content') || classes.includes('vExplain_s') || classes.includes('vExplain_r') || classes.includes('vEn_tip'))) {
          // Various containers - ignore
        } else {
          this.reportUnknown('INIT', selector, path)
        }
        break
        
      case 'IN_CONTENT':
        if (classes.includes('caption')) {
          this.startDefinition()
          this.pushState('IN_CAPTION')
        } else {
          this.reportUnknown('IN_CONTENT', selector, path)
        }
        break
        
      case 'IN_CAPTION':
        if (classes.includes('num')) {
          this.pushState('IN_NUM')
        } else if (classes.includes('st')) {
          this.pushState('IN_POS')
        } else if (classes.includes('text_blue')) {
          this.pushState('IN_ZH')
        } else if (tag === 'b' || tag === 'span' || tag === 'a' || tag === 'div' || tag === 'i' || tag === 'strong' || tag === 'em') {
          // Inline formatting - collect as English text
          // Don't push state, just stay in IN_CAPTION
        } else if (tag === 'dl') {
          // Related phrases section
          this.pushState('IN_RELATED')
        } else if (tag === 'br' || tag === 'l') {
          // Line breaks and other formatting - ignore
        } else {
          // Unknown but likely just nested formatting
          this.reportUnknown('IN_CAPTION', tag + '.' + classes.join('.'), path)
        }
        break
        
      case 'IN_NUM':
        // Just ignore numbers
        this.textBuffer = []
        this.popState()
        break
        
      case 'IN_POS':
        // Text collection handled in endElement
        this.popState()
        break
        
      case 'IN_ZH':
        // Text collection handled in endElement  
        this.popState()
        break
        
      case 'IN_EN':
        // Text collection handled in endElement
        this.popState()
        break
        
      case 'AFTER_CAPTION':
        if (tag === 'ul') {
          this.pushState('IN_EXAMPLES')
        } else if (classes.includes('caption')) {
          // Next definition
          this.startDefinition()
          this.pushState('IN_CAPTION')
        } else if (classes.includes('collins_en_cn')) {
          // Another collins_en_cn block (multiple definitions)
          this.pushState('IN_CONTENT')
        } else if (tag === 'div' || tag === 'span' || tag === 'b' || tag === 'p' || tag === 'a' || tag === 'br' || tag === 'i' || tag === 'strong' || tag === 'li' || tag === 'l') {
          // Various formatting/content elements - likely nested or misplaced
          // Report but don't crash
          this.reportUnknown('AFTER_CAPTION', selector, path)
        } else {
          this.reportUnknown('AFTER_CAPTION', selector, path)
        }
        break
        
      case 'IN_EXAMPLES':
        if (tag === 'li') {
          if (classes.includes('en_tip') || classes.includes('bg_doc')) {
            this.startUsageNote()
            this.pushState('IN_USAGE_NOTE')
          } else {
            this.startExample()
            this.pushState('IN_EXAMPLE')
          }
        } else {
          this.reportUnknown('IN_EXAMPLES', selector, path)
        }
        break
        
      case 'IN_EXAMPLE':
        if (tag === 'p') {
          if (!this.currentEx.en) {
            this.pushState('IN_EX_EN')
          } else if (!this.currentEx.zh) {
            this.pushState('IN_EX_ZH')
          }
        } else {
          this.reportUnknown('IN_EXAMPLE', selector, path)
        }
        break
        
      case 'IN_USAGE_NOTE':
        if (tag === 'b' || tag === 'span' || classes.includes('text_blue')) {
          // Usage note text
        } else if (tag === 'ul' && classes.includes('vli')) {
          this.pushState('IN_USAGE_EXAMPLES')
        }
        break
        
      case 'IN_USAGE_EXAMPLES':
        if (tag === 'li') {
          this.startUsageExample()
          this.pushState('IN_USAGE_EXAMPLE')
        }
        break
        
      case 'IN_USAGE_EXAMPLE':
        if (tag === 'p') {
          if (!this.currentUsageEx.en) {
            this.pushState('IN_USAGE_EX_EN')
          } else if (!this.currentUsageEx.zh) {
            this.pushState('IN_USAGE_EX_ZH')
          }
        }
        break
        
      case 'IN_RELATED':
        if (tag === 'dt' || tag === 'dd' || tag === 'a') {
          // Collect related phrases
        }
        break
        
      case 'IN_EX_EN':
      case 'IN_EX_ZH':
      case 'IN_USAGE_EX_EN':
      case 'IN_USAGE_EX_ZH':
        // Text collection - allow nested tags
        break
        
      default:
        this.reportUnknown(this.state, selector, path)
    }
  }
  
  text(content) {
    const trimmed = content.trim()
    if (!trimmed) return
    
    this.textBuffer.push(trimmed)
  }
  
  endElement(tag, classes) {
    const classStr = classes.join('.')
    const selector = classes.length > 0 ? `${tag}.${classStr}` : tag
    
    // Collect accumulated text
    const text = this.textBuffer.join(' ').trim()
    this.textBuffer = []
    
    switch (this.state) {
      case 'IN_NUM':
        // Ignore number
        this.popState()
        break
        
      case 'IN_POS':
        if (text) {
          this.parsePOS(text)
        }
        this.popState()
        break
        
      case 'IN_ZH':
        if (text && this.currentDef) {
          this.currentDef.zh = text
        }
        this.popState()
        break
        
      case 'IN_EN':
        if (text && this.currentDef) {
          this.currentDef.en = (this.currentDef.en || '') + ' ' + text
        }
        this.popState()
        break
        
      case 'IN_CAPTION':
        // Check if we're ending the caption itself or a nested element
        if (classes.includes('caption')) {
          // Ending the caption element
          if (text && this.currentDef) {
            // Skip if it's just the headword alone
            if (text !== this.word && text !== `-${this.word}` && text !== `+${this.word}`) {
              this.currentDef.en = (this.currentDef.en || '') + ' ' + text
            }
          }
          // Clean up the English text
          if (this.currentDef.en) {
            this.currentDef.en = this.currentDef.en.trim()
          }
          this.popState()
          this.state = 'AFTER_CAPTION'
        } else {
          // Ending a nested element (b, span, etc) while in IN_CAPTION
          // Collect text as English definition
          if (text && this.currentDef) {
            if (text !== this.word && text !== `-${this.word}` && text !== `+${this.word}`) {
              this.currentDef.en = (this.currentDef.en || '') + ' ' + text
            }
          }
        }
        break
        
      default:
        // For any unhandled states when ending elements,
        // if we have text and we're nested in IN_CAPTION, collect it
        if (text && this.currentDef && this.stateStack.includes('IN_CAPTION')) {
          if (text !== this.word && text !== `-${this.word}` && text !== `+${this.word}`) {
            this.currentDef.en = (this.currentDef.en || '') + ' ' + text
          }
        }
        break
        
      case 'IN_EX_EN':
        if (text && this.currentEx) {
          this.currentEx.en = text
        }
        this.popState()
        break
        
      case 'IN_EX_ZH':
        if (text && this.currentEx) {
          this.currentEx.zh = text
        }
        this.popState()
        break
        
      case 'IN_EXAMPLE':
        this.finishExample()
        this.popState()
        break
        
      case 'IN_USAGE_NOTE':
        if (text && this.currentUsageNote) {
          this.currentUsageNote.text = (this.currentUsageNote.text || '') + ' ' + text
        }
        this.finishUsageNote()
        this.popState()
        break
        
      case 'IN_USAGE_EX_EN':
        if (text && this.currentUsageEx) {
          this.currentUsageEx.en = text
        }
        this.popState()
        break
        
      case 'IN_USAGE_EX_ZH':
        if (text && this.currentUsageEx) {
          this.currentUsageEx.zh = text
        }
        this.popState()
        break
        
      case 'IN_USAGE_EXAMPLE':
        this.finishUsageExample()
        this.popState()
        break
        
      case 'IN_USAGE_EXAMPLES':
        this.popState()
        break
        
      case 'IN_EXAMPLES':
        this.popState()
        this.state = 'AFTER_CAPTION'
        break
        
      case 'IN_RELATED':
        if (text) {
          if (!this.currentRefTo) {
            this.currentRefTo = { phrases: [] }
          }
          // Extract phrase links
          const phrases = text.match(/[\w\s-]+/g) || []
          this.currentRefTo.phrases.push(...phrases.filter(p => p.trim()))
        }
        if (this.currentRefTo && this.currentRefTo.phrases.length > 0) {
          this.result.refTo.push(this.currentRefTo)
          this.currentRefTo = null
        }
        this.popState()
        break
    }
  }
  
  // State management
  pushState(newState) {
    this.stateStack.push(this.state)
    this.state = newState
  }
  
  popState() {
    if (this.stateStack.length > 0) {
      this.state = this.stateStack.pop()
    }
  }
  
  // Definition management
  startDefinition() {
    if (this.currentDef) {
      this.finishDefinition()
    }
    this.currentDef = {
      pos: '',
      posZh: '',
      en: '',
      zh: '',
      exs: []
    }
  }
  
  finishDefinition() {
    if (this.currentDef && (this.currentDef.en || this.currentDef.zh || this.currentDef.pos)) {
      this.result.defs.push(this.currentDef)
    }
    this.currentDef = null
  }
  
  parsePOS(text) {
    // POS format: "SUFFIX\t后缀" or "PHRASE 短语"
    const parts = text.split(/[\t\s]+/)
    if (parts.length >= 2) {
      this.currentDef.pos = parts[0]
      this.currentDef.posZh = parts.slice(1).join(' ')
    } else {
      this.currentDef.pos = text
    }
  }
  
  // Example management
  startExample() {
    this.currentEx = { en: '', zh: '' }
  }
  
  finishExample() {
    if (this.currentEx && this.currentEx.en && this.currentDef) {
      this.currentDef.exs.push(this.currentEx)
    }
    this.currentEx = null
  }
  
  // Usage note management
  startUsageNote() {
    this.currentUsageNote = {
      text: '',
      zh: '',
      exs: []
    }
  }
  
  finishUsageNote() {
    if (this.currentUsageNote && this.currentUsageNote.text) {
      // Add usage note as a special example with nested exs
      if (this.currentDef) {
        this.currentDef.exs.push({
          en: this.currentUsageNote.text.trim(),
          zh: this.currentUsageNote.zh,
          exs: this.currentUsageNote.exs
        })
      }
    }
    this.currentUsageNote = null
  }
  
  startUsageExample() {
    this.currentUsageEx = { en: '', zh: '' }
  }
  
  finishUsageExample() {
    if (this.currentUsageEx && this.currentUsageEx.en && this.currentUsageNote) {
      this.currentUsageNote.exs.push(this.currentUsageEx)
    }
    this.currentUsageEx = null
  }
  
  // Unknown pattern tracking
  reportUnknown(state, selector, path) {
    const pathStr = path.join(' > ')
    this.unknownPatterns.push({
      state,
      selector,
      path: pathStr
    })
  }
  
  // Finalization
  finish() {
    if (this.currentDef) {
      this.finishDefinition()
    }
    
    return {
      result: this.result,
      unknownPatterns: this.unknownPatterns
    }
  }
}

