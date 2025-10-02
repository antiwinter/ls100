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
    this.currentDefIsSeeAlso = false
    
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
          // Inline elements - text will be collected automatically
        } else if (tag === 'ul' && classes.includes('vli')) {
          // Nested examples list - push state to handle them
          this.pushState('IN_USAGE_EXAMPLES')
        } else if (tag === 'p' || tag === 'i' || tag === 'strong') {
          // Allow these inline/block elements
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
    // Don't trim - preserve natural spacing for inline elements
    // We'll trim the final result instead
    if (!content) return
    
    this.textBuffer.push(content)
  }
  
  endElement(tag, classes) {
    const classStr = classes.join('.')
    const selector = classes.length > 0 ? `${tag}.${classStr}` : tag
    
    // Collect accumulated text
    // Join without extra spaces and normalize whitespace
    const text = this.textBuffer.join('').replace(/\s+/g, ' ').trim()
    
    switch (this.state) {
      case 'IN_NUM':
        // Ignore number
        this.textBuffer = []
        this.popState()
        break
        
      case 'IN_POS':
        if (text) {
          this.parsePOS(text)
        }
        this.textBuffer = []
        this.popState()
        break
        
      case 'IN_ZH':
        if (text && this.currentDef) {
          this.currentDef.zh = text
        }
        this.textBuffer = []
        this.popState()
        break
        
      case 'IN_EN':
        if (text && this.currentDef) {
          this.currentDef.en = (this.currentDef.en || '') + ' ' + text
        }
        this.textBuffer = []
        this.popState()
        break
        
      case 'IN_CAPTION':
        // Check if we're ending the caption itself or a nested element
        if (classes.includes('caption')) {
          // Ending the caption element - collect all accumulated text
          if (text && this.currentDef) {
            // Skip if it's just the headword alone
            if (text !== this.word && text !== `-${this.word}` && text !== `+${this.word}`) {
              this.currentDef.en = text
            }
          }
          // Extract cross-references from Chinese text if this is a partial "See also:"
          // (definitions that have both real content and cross-references)
          if (this.currentDef.zh && !this.currentDefIsSeeAlso && this.currentDef.pos) {
            this.extractInlineReferences()
          }
          // Clean up the English text and extract grammar info
          if (this.currentDef.en) {
            this.currentDef.en = this.currentDef.en.trim()
            // Extract 【语法信息】and add to POS
            this.extractGrammarInfo()
          }
          this.textBuffer = []
          this.popState()
          this.state = 'AFTER_CAPTION'
        } else {
          // Ending a nested element (b, span, etc) while in IN_CAPTION
          // Check if it's a grammar info div - if so, skip its text
          if (tag === 'div' && this.path.some(p => p.includes('word_gram'))) {
            // Skip grammar info div text - clear buffer
            this.textBuffer = []
          } else if (tag === 'span' && (this.path.some(p => p.includes('word_gram')) || classes.includes('text_blue'))) {
            // Skip grammar spans and text_blue spans from definition
            // But don't clear buffer - there might be other text
          }
          // Don't clear textBuffer for most nested elements - keep accumulating
        }
        break
        
      case 'IN_EX_EN':
        // Only clear and pop when we're closing the <p> tag itself
        if (tag === 'p') {
          if (text && this.currentEx) {
            this.currentEx.en = text
          }
          this.textBuffer = []
          this.popState()
        }
        // Don't clear buffer for nested tags - keep accumulating
        break
        
      case 'IN_EX_ZH':
        // Only clear and pop when we're closing the <p> tag itself
        if (tag === 'p') {
          if (text && this.currentEx) {
            this.currentEx.zh = text
          }
          this.textBuffer = []
          this.popState()
        }
        // Don't clear buffer for nested tags - keep accumulating
        break
        
      case 'IN_EXAMPLE':
        this.finishExample()
        this.textBuffer = []
        this.popState()
        break
        
      case 'IN_USAGE_NOTE':
        // Collect text from inline elements (but not from nested ul which has its own state)
        if ((tag === 'b' || tag === 'span') && text && this.currentUsageNote) {
          // Only add non-empty text
          if (text.trim()) {
            this.currentUsageNote.text = (this.currentUsageNote.text || '') + ' ' + text
          }
          this.textBuffer = []
        } else if (tag === 'li' && (classes.includes('en_tip') || classes.includes('bg_doc'))) {
          // Closing the usage note li - finalize it
          // Note: nested examples have already been collected via IN_USAGE_EXAMPLES state
          this.finishUsageNote()
          this.textBuffer = []
          this.popState()
        }
        break
        
      case 'IN_USAGE_EX_EN':
        // Only clear and pop when we're closing the <p> tag itself
        if (tag === 'p') {
          if (text && this.currentUsageEx) {
            this.currentUsageEx.en = text
          }
          this.textBuffer = []
          this.popState()
        }
        break
        
      case 'IN_USAGE_EX_ZH':
        // Only clear and pop when we're closing the <p> tag itself
        if (tag === 'p') {
          if (text && this.currentUsageEx) {
            this.currentUsageEx.zh = text
          }
          this.textBuffer = []
          this.popState()
        }
        break
        
      case 'IN_USAGE_EXAMPLE':
        // Only finish when closing the <li> tag itself
        if (tag === 'li') {
          this.finishUsageExample()
          this.textBuffer = []
          this.popState()
        }
        break
        
      case 'IN_USAGE_EXAMPLES':
        // Only pop when closing the <ul> tag itself
        if (tag === 'ul' && classes.includes('vli')) {
          this.textBuffer = []
          this.popState()
        }
        break
        
      case 'IN_EXAMPLES':
        this.textBuffer = []
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
        this.textBuffer = []
        this.popState()
        break
        
      default:
        // For any unhandled states, don't clear the buffer
        // This allows text to accumulate through nested tags
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
    this.currentDefIsSeeAlso = false
  }
  
  finishDefinition() {
    if (!this.currentDef) return
    
    // Check if this is a "See also:" entry
    if (this.currentDefIsSeeAlso) {
      // Extract referenced words from zh field (they end up there from text_blue)
      // Filter out Chinese text - only keep English phrases
      const referencedWords = (this.currentDef.zh || this.currentDef.en)
        .split(/[;,]/)
        .map(w => w.trim())
        .filter(w => {
          // Keep only if it doesn't contain Chinese characters
          // and is not empty
          return w && w !== '' && !/[\u4e00-\u9fa5]/.test(w)
        })
      
      if (referencedWords.length > 0) {
        this.result.refTo.push({ phrases: referencedWords })
      }
    } else if (this.currentDef.en || this.currentDef.zh || this.currentDef.pos) {
      // Regular definition - add to defs
      this.result.defs.push(this.currentDef)
    }
    
    this.currentDef = null
    this.currentDefIsSeeAlso = false
  }
  
  parsePOS(text) {
    // Check if this is ONLY "See also:" (not a real definition)
    // It's only a reference if there's no real POS before it
    if ((text.includes('See also:') || text.startsWith('See')) && !this.currentDef.pos) {
      this.currentDefIsSeeAlso = true
      this.currentDef.pos = text.trim()
      this.currentDef.posZh = ''
      return
    }
    
    // If we already have a POS and this is "See also:", skip it
    // (it's just additional cross-references in the same definition)
    if (text.includes('See also:') && this.currentDef.pos) {
      // This is a "See also:" that appears AFTER a real POS tag
      // We'll handle extracting the references separately
      return
    }
    
    // POS format: "COMB in ADJ-GRADED\t用在形容词最高级后" or "PHRASE 短语"
    // Split at first Chinese character, not whitespace (English POS can have spaces)
    text = text.replace(/[\r\n<>]/g, '').trim()
    const match = text.match(/^([^\u4e00-\u9fa5]+)([\u4e00-\u9fa5].*)$/)
    if (match) {
      this.currentDef.pos = match[1].trim()
      this.currentDef.posZh = match[2].trim()
    } else {
      this.currentDef.pos = text
      this.currentDef.posZh = ''
    }
  }
  
  extractGrammarInfo() {
    if (!this.currentDef || !this.currentDef.en) return
    
    // Find all grammar patterns: 【语法信息】：V n, 【语法信息】：V-ed, etc.
    // Match everything between 【语法信息】： and the next 【 or end of text
    const grammarPattern = /【语法信息】[：:]\s*([A-Za-z0-9\s\-<>]+?)(?=\s*【|$)/g
    const grammarInfos = []
    let match
    
    while ((match = grammarPattern.exec(this.currentDef.en)) !== null) {
      const grammarText = match[1].trim().replace(/<[^>]+>/g, '').trim()
      if (grammarText && !grammarText.includes('【')) {
        grammarInfos.push(grammarText)
      }
    }
    
    // Extract label tags (STYLE, 语域, FIELD)
    this.extractLabels()
    
    // Remove all grammar/pattern/usage info text from the definition
    this.currentDef.en = this.currentDef.en
      .replace(/【语法信息】[：:][^【]*?(?=【|$)/g, '')
      .replace(/【搭配模式】[：:][^【]*?(?=【|$)/g, '')
      .replace(/【语用信息】[：:][^【]*?(?=【|$)/g, '')
      .replace(/【STYLE标签】[：:][^【]*?(?=【|$)/g, '')
      .replace(/【语域标签】[：:][^【]*?(?=【|$)/g, '')
      .replace(/【FIELD标签】[：:][^【]*?(?=【|$)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Append grammar info to POS if any found
    if (grammarInfos.length > 0 && this.currentDef.pos) {
      this.currentDef.pos = this.currentDef.pos + ', ' + grammarInfos.join(', ')
    }
  }
  
  extractLabels() {
    if (!this.currentDef || !this.currentDef.en) return
    
    const labels = []
    
    // Pattern to match all label types: 【...标签】：VALUE
    // Captures English letters, spaces, and hyphens until Chinese char or 【
    // Examples: 【STYLE标签】：FORMAL 正式, 【STYLE标签】：HUMOROUS or OLD-FASHIONED 幽默或过时
    const labelPattern = /【(?:STYLE标签|语域标签|FIELD标签)】[：:]([A-Za-z\s-]+?)(?=\s*[\u4e00-\u9fa5【]|$)/g
    let match
    
    while ((match = labelPattern.exec(this.currentDef.en)) !== null) {
      const labelValue = match[1].trim()
      if (labelValue) {
        // Split on " or " to handle combinations like "FORMAL or HUMOROUS"
        const splitLabels = labelValue.split(' or ')
        for (const label of splitLabels) {
          const trimmed = label.trim()
          if (trimmed) {
            labels.push(trimmed)
          }
        }
      }
    }
    
    // Deduplicate labels
    if (labels.length > 0) {
      this.currentDef.labels = [...new Set(labels)]
    }
  }
  
  extractInlineReferences() {
    // Extract cross-references that appear inline with a definition
    // (e.g., "See also: love affair" within a real definition)
    if (!this.currentDef || !this.currentDef.zh) return
    
    const referencedWords = this.currentDef.zh
      .split(/[;,]/)
      .map(w => w.trim())
      .filter(w => {
        // Keep only English words/phrases (filter out Chinese)
        return w && w !== '' && !/[\u4e00-\u9fa5]/.test(w)
      })
    
    if (referencedWords.length > 0) {
      // Add to global refTo in the same format as regular references
      // (will be flattened in finish())
      this.result.refTo.push({ phrases: referencedWords })
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
    
    // Flatten refTo structure from [{phrases: [...]}, {phrases: [...]}] to [...]
    if (this.result.refTo && this.result.refTo.length > 0) {
      const allPhrases = []
      for (const group of this.result.refTo) {
        if (group.phrases && Array.isArray(group.phrases)) {
          allPhrases.push(...group.phrases)
        }
      }
      this.result.refTo = allPhrases
    }
    
    return {
      result: this.result,
      unknownPatterns: this.unknownPatterns
    }
  }
}

