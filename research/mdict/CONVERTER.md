# MDict Converter

Parser-agnostic tool for converting MDict dictionaries (`.mdx` files) to structured JSON.

---

## Quick Start

```bash
# Install dependencies
yarn install

# Convert first 100 entries
./convert-v2.js /path/to/dictionary.mdx -c 100

# Convert starting from a specific word
./convert-v2.js dictionary.mdx --start=abandon -c 500

# Convert all entries
./convert-v2.js dictionary.mdx -o output.json

# Use different parser
./convert-v2.js dictionary.mdx --parser=ee
```

---

## CLI Reference

```bash
./convert-v2.js <mdx-file> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `<mdx-file>` | Path to MDX dictionary file |

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--parser` | `-p` | Parser to use | `ece` |
| `--output` | `-o` | Output JSON file | `<mdx-name>-converted.json` |
| `--start` | `-s` | Start from specific word | Beginning |
| `--count` | `-c` | Number of entries | All |
| `--help` | `-h` | Show help | - |

### Examples

```bash
# Quick test: first 10 entries
./convert-v2.js Collins-Advanced-ECE.mdx -c 10

# Extract a specific range
./convert-v2.js Collins-Advanced-ECE.mdx --start=abandon -c 1000

# Full extraction (takes ~1 hour for 36k entries)
./convert-v2.js Collins-Advanced-ECE.mdx -o collins-full.json

# Use different parser
./convert-v2.js Collins-2015.mdx --parser=2015 -c 100
```

---

## How It Works

### Two-Stage Pipeline

The converter uses a **parser-agnostic architecture** that separates generic DOM traversal from dictionary-specific parsing.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ MDX File     │ →  │ Converter    │ →  │ Parser       │ → JSON
│ (binary)     │    │ (generic)    │    │ (dict-spec)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

**Stage 1: Converter** (`convert-v2.js`)
- Loads MDX file → extracts HTML
- Walks DOM tree depth-first
- Emits events: `startElement`, `text`, `endElement`
- **Works with ANY dictionary format**

**Stage 2: Parser** (`parser-*.js`)
- Receives DOM events
- State machine recognizes patterns
- Extracts structured data
- **Dictionary-specific logic**

### Why This Design?

Different MDict dictionaries have completely different HTML structures. Instead of writing a monolithic converter for each:

1. Write the DOM walker once (works for all dictionaries)
2. Write small parsers for each format (only the patterns change)

**Result:** Support new dictionary = write 1 parser file (~500 lines), reuse converter (~350 lines).

### Event Flow Example

For HTML: `<div class="def"><span class="pos">NOUN</span> Definition</div>`

```javascript
// Converter emits:
startElement('div', ['def'], {}, ['div.def'])
  startElement('span', ['pos'], {}, ['div.def', 'span.pos'])
    text('NOUN')
  endElement('span', ['pos'])
  text(' Definition')
endElement('div', ['def'])

// Parser receives events and builds:
{
  pos: 'NOUN',
  definition: 'Definition'
}
```

### Parser Interface

Any parser must implement 4 methods:

```javascript
class Parser {
  constructor(word) {
    // Initialize for single entry
  }
  
  startElement(tag, classes, attrs, path) {
    // Handle opening tag
    // tag: 'div', 'span', etc.
    // classes: ['caption', 'text_blue']
    // attrs: {id: 'x', style: '...'}
    // path: ['div.content', 'div.caption', 'span.st']
  }
  
  text(content) {
    // Handle text content (trimmed)
  }
  
  endElement(tag, classes) {
    // Handle closing tag
  }
  
  finish() {
    // Return result
    return {
      result: {...},          // Structured entry data
      unknownPatterns: [...]  // Optional: unrecognized HTML
    }
  }
}
```

**That's it.** Implement these 4 methods, the converter handles everything else.

### Unknown Pattern Detection

Parsers can report HTML patterns they don't understand:

```javascript
// In parser:
this.unknownPatterns.push({
  state: 'IN_EXAMPLES',
  selector: 'div.new-class',
  path: ['div.content', 'ul', 'li', 'div.new-class']
})

// Converter reports:
⚠️ UNKNOWN PATTERNS DETECTED

AFTER_CAPTION → div.new-class: 45 occurrences
  Examples: word1, word2, word3
```

This helps identify:
- Edge cases not handled yet
- New HTML structures to support
- Parser completeness

---

## Output Format

### Collins ECE/EE Output

```json
{
  "word": "ability",
  "defs": [
    {
      "pos": "NOUN",
      "posZh": "名词",
      "en": "Your ability to do something is the fact that you can do it.",
      "zh": "能力是指你能够做某事的事实。",
      "exs": [
        {
          "en": "The public never had faith in his ability to handle the job.",
          "zh": "公众从来都不相信他有能力胜任这份工作。"
        },
        {
          "en": "He has the ability to bring out the best in others.",
          "zh": "他能够激发别人最好的一面。"
        }
      ]
    },
    {
      "pos": "N-COUNT",
      "posZh": "可数名词",
      "en": "Your ability is the quality or skill that you have which makes it possible for you to do something.",
      "zh": "才能是你所拥有的使你能够做某事的品质或技能。",
      "exs": [
        {
          "en": "Her drama teacher noticed her acting ability.",
          "zh": "她的戏剧老师注意到了她的表演才能。"
        }
      ]
    }
  ],
  "refTo": [
    {
      "phrases": ["see also", "mixed ability"]
    }
  ]
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `word` | string | Headword |
| `defs` | array | Definitions (multiple per word) |
| `defs[].pos` | string | Part of speech (English) |
| `defs[].posZh` | string | Part of speech (Chinese) |
| `defs[].en` | string | English definition |
| `defs[].zh` | string | Chinese translation |
| `defs[].exs` | array | Example sentences |
| `defs[].exs[].en` | string | English example |
| `defs[].exs[].zh` | string | Chinese translation |
| `defs[].exs[].exs` | array | Nested examples (usage notes) |
| `refTo` | array | Related phrases/cross-references |
| `refTo[].phrases` | array | Phrase list per group |

### Data Characteristics

**From 1000-entry sample (Collins ECE):**

| Metric | Value |
|--------|-------|
| Success rate | 100% (1000/1000) |
| Avg definitions/word | 2.8 |
| Entries with Chinese | 96%+ |
| Entries with examples | 77%+ |
| Entries with POS | 100% |
| File size | ~800KB/1000 entries |
| Estimated full size | ~30MB for 36k entries |

### Output Variations by Dictionary

**Collins ECE (English-Chinese)**
- Bilingual: `pos`, `posZh`, `en`, `zh`, examples in both languages
- Most complete data

**Collins EE (English-English)**
- Monolingual: `pos`, `en`, examples in English only
- No `posZh` or `zh` fields

**Collins Thesaurus**
- Different structure: synonyms, antonyms, related words
- Requires different parser

---

## Creating a New Parser

### Step 1: Analyze HTML Structure

Extract sample entries to understand the HTML:

```bash
node -e "
  const {MDX} = require('js-mdict');
  const fs = require('fs');
  const mdx = new MDX('new-dict.mdx');
  
  // Get first 10 entries
  const list = mdx.keywordList.slice(0, 10);
  list.forEach(item => {
    const word = item.keyText;
    const result = mdx.lookup(word);
    fs.writeFileSync(\`samples/\${word}.html\`, result.definition);
  });
"
```

### Step 2: Identify Patterns

Look for common HTML patterns:

```html
<!-- Where is the POS tag? -->
<span class="st">NOUN 名词</span>

<!-- Where is the definition? -->
<div class="caption">Definition text here</div>

<!-- Where are examples? -->
<ul>
  <li><p>Example sentence</p><p>Translation</p></li>
</ul>
```

### Step 3: Design State Machine

Map HTML patterns to states:

```
INIT
  → found <div class="collins_en_cn"> → IN_CONTENT
    → found <div class="caption"> → IN_CAPTION
      → found <span class="st"> → IN_POS
      → found <span class="text_blue"> → IN_ZH
    → found <ul> → IN_EXAMPLES
      → found <li> → IN_EXAMPLE_ITEM
```

### Step 4: Implement Parser

```javascript
// parser-newdict.js
export class NewDictParser {
  constructor(word) {
    this.word = word
    this.result = { word, defs: [] }
    this.state = 'INIT'
    this.currentDef = null
  }
  
  startElement(tag, classes, attrs, path) {
    if (this.state === 'INIT' && classes.includes('entry')) {
      this.state = 'IN_ENTRY'
    }
    // ... more state transitions
  }
  
  text(content) {
    // Accumulate text based on current state
  }
  
  endElement(tag, classes) {
    // Process accumulated data
  }
  
  finish() {
    return { result: this.result }
  }
}
```

### Step 5: Test and Iterate

```bash
# Test on samples
./convert-v2.js new-dict.mdx --parser=newdict -c 100

# Check unknown patterns
# Update parser to handle them
# Repeat
```

### Simple Example Parser

Extract just text content (ignores structure):

```javascript
// parser-simple.js
export class SimpleParser {
  constructor(word) {
    this.word = word
    this.text = []
  }
  
  startElement() {} // Ignore
  text(t) { this.text.push(t) }
  endElement() {} // Ignore
  
  finish() {
    return {
      result: {
        word: this.word,
        text: this.text.join(' ')
      }
    }
  }
}
```

```bash
./convert-v2.js dict.mdx --parser=simple -c 10
# Output: [{"word":"ability","text":"NOUN 名词 Definition..."}]
```

---

## Performance

### Speed

- **~10 entries/second** (typical hardware)
- Bottleneck: HTML parsing (cheerio)
- Stable memory usage (streaming)

### Estimated Times

| Entries | Time |
|---------|------|
| 100 | 10s |
| 1,000 | 2min |
| 10,000 | 17min |
| 36,000 | 1hour |

### Memory

- ~50KB per entry during processing
- No accumulation (streaming)
- Suitable for large dictionaries (100k+ entries)

### Optimization Tips

1. **Use `--count`** for testing (don't process full dictionary during development)
2. **Use `--start`** to resume from specific word
3. **Process in chunks** for very large dictionaries:
   ```bash
   ./convert-v2.js dict.mdx --start=a -c 10000 -o part1.json
   ./convert-v2.js dict.mdx --start=h -c 10000 -o part2.json
   # ...then merge
   ```

---

## Troubleshooting

### Parser Not Found

```
❌ Error loading parser 'xyz': Cannot find module './parser-xyz.js'
```

**Solution:** Ensure `parser-xyz.js` exists in the same directory as `convert-v2.js`

### MDX File Not Found

```
❌ Error: MDX file not found: /path/to/file.mdx
```

**Solution:** Check file path. Dictionary files are in `/server/lib/collins/`

### Low Conversion Success Rate

Check unknown patterns in output. Update parser to handle them.

### Memory Issues

Process in chunks using `--start` and `--count` options.

---

## Architecture Benefits

### 1. Separation of Concerns
- **Converter**: HTML traversal (generic)
- **Parser**: Dictionary semantics (specific)
- Clean boundaries

### 2. Reusability
- Converter works for ALL dictionaries
- 70% code reuse across formats
- Only parser changes

### 3. Extensibility
- Add new dictionary = write 1 parser
- No modification to converter
- Plug-and-play architecture

### 4. Testability
- Test converter with mock parser
- Test parser with mock events
- Independent unit tests

### 5. Debuggability
- Explicit event sequence
- State transitions traceable
- Unknown patterns auto-reported

---

## Project Files

```
research/mdict/
├── convert-v2.js         # Main converter (DO NOT MODIFY)
├── parser-ece.js         # Collins ECE parser
├── package.json          # Dependencies
├── 1/                    # Output directory
│   ├── Collins-Advanced-ECE/    # Extracted HTML samples
│   ├── collins-ece-1000.json    # Sample output
│   └── ...
├── CONVERTER.md          # This file
└── DICT_FINDINGS.md      # Dictionary research findings
```

**Dictionary files:** `/server/lib/collins/*.mdx` (not in this directory)

