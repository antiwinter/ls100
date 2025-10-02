# Dictionary Converter v2 - Usage Guide

## Overview

`convert-v2.js` is a **parser-agnostic** stream-based dictionary converter that can work with any MDX dictionary file and any parser implementation.

## Architecture

### Parser-Agnostic Design

The converter is completely decoupled from specific parser implementations:

```javascript
// Converter only requires parser to implement these methods:
parser.startElement(tag, classes, attrs, path)
parser.text(content)
parser.endElement(tag, classes)
parser.finish() // Returns { result, unknownPatterns }
```

### How It Works

1. **Load MDX** - Reads dictionary file using `js-mdict`
2. **Load Parser** - Dynamically imports parser module
3. **Walk DOM** - Traverses HTML structure depth-first
4. **Emit Events** - Calls parser methods with element info
5. **Collect Results** - Parser accumulates data and returns JSON

## Command-Line Usage

### Basic Syntax

```bash
./convert-v2.js <mdx-file> [options]
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--parser` | `-p` | Parser to use | `ece` |
| `--output` | `-o` | Output JSON file | `<mdx-name>-converted.json` |
| `--start` | `-s` | Start from specific word | Beginning |
| `--count` | `-c` | Number of entries | All |
| `--help` | `-h` | Show help | - |

### Examples

#### Convert first 1000 entries
```bash
./convert-v2.js Collins-Advanced-ECE.mdx -c 1000
```

#### Convert starting from a specific word
```bash
./convert-v2.js Collins-Advanced-ECE.mdx --start=abandon -c 500
```

#### Convert all entries with custom output
```bash
./convert-v2.js Collins-Advanced-ECE.mdx -o output.json
```

#### Use a different parser
```bash
./convert-v2.js Other-Dictionary.mdx --parser=ee
```

#### Batch processing
```bash
# Convert in chunks for large dictionaries
./convert-v2.js dict.mdx --start=a -c 5000 -o part1.json
./convert-v2.js dict.mdx --start=g -c 5000 -o part2.json
./convert-v2.js dict.mdx --start=m -c 5000 -o part3.json
```

## Creating a New Parser

To create a parser for a different dictionary format:

### 1. Create Parser File

```javascript
// parser-mydictionary.js

export class MyDictionaryParser {
  constructor(word) {
    this.word = word
    this.result = { word, defs: [] }
    this.state = 'INIT'
    // ... your state variables
  }
  
  startElement(tag, classes, attrs, path) {
    // Handle element start
    // Update state machine
  }
  
  text(content) {
    // Collect text content
  }
  
  endElement(tag, classes) {
    // Handle element end
    // Process accumulated data
  }
  
  finish() {
    return {
      result: this.result,
      unknownPatterns: []  // Optional: report unrecognized structures
    }
  }
}
```

### 2. Use Your Parser

```bash
./convert-v2.js your-dictionary.mdx --parser=mydictionary
```

The converter will automatically load `parser-mydictionary.js`.

## Parser Interface Contract

### Required Methods

#### `constructor(word)`
- **Purpose**: Initialize parser for a single entry
- **Parameters**: `word` (string) - The headword being parsed

#### `startElement(tag, classes, attrs, path)`
- **Purpose**: Handle opening tag
- **Parameters**:
  - `tag` (string) - HTML tag name (e.g., 'div', 'span')
  - `classes` (array) - CSS classes (e.g., ['caption', 'text_blue'])
  - `attrs` (object) - HTML attributes (e.g., {id: 'x', style: '...'})
  - `path` (array) - Full DOM path (e.g., ['div.main', 'div.content', 'span.text'])

#### `text(content)`
- **Purpose**: Handle text node
- **Parameters**: `content` (string) - Text content (trimmed)

#### `endElement(tag, classes)`
- **Purpose**: Handle closing tag
- **Parameters**:
  - `tag` (string) - HTML tag name
  - `classes` (array) - CSS classes

#### `finish()`
- **Purpose**: Finalize parsing and return result
- **Returns**: Object with:
  - `result` (object) - The parsed entry data
  - `unknownPatterns` (array) - Optional: Unknown HTML patterns found

### Example Event Sequence

For HTML: `<div class="def"><span class="pos">NOUN</span> A thing</div>`

```
startElement('div', ['def'], {}, ['div.def'])
  startElement('span', ['pos'], {}, ['div.def', 'span.pos'])
    text('NOUN')
  endElement('span', ['pos'])
  text(' A thing')
endElement('div', ['def'])
finish()
```

## Output Format

The converter saves results as JSON array. Format depends on parser implementation.

### Collins ECE Parser Output

```json
[
  {
    "word": "ability",
    "defs": [
      {
        "pos": "NOUN",
        "posZh": "名词",
        "en": "English definition...",
        "zh": "中文释义...",
        "exs": [
          {"en": "Example", "zh": "例句"}
        ]
      }
    ],
    "refTo": [
      {"phrases": ["see also"]}
    ]
  }
]
```

## Performance

- **Speed**: ~10 entries/second (depends on parser complexity)
- **Memory**: Streaming approach, stable memory usage
- **Large dictionaries**: Use chunking (--start and --count)

### Estimated Times

| Entries | Time |
|---------|------|
| 1,000 | ~2 min |
| 10,000 | ~17 min |
| 36,000 | ~1 hour |

## Troubleshooting

### Parser Not Found

```
❌ Error loading parser 'xyz': Cannot find module './parser-xyz.js'
```
**Solution**: Ensure `parser-xyz.js` exists in the same directory

### Invalid MDX File

```
❌ Error: MDX file not found: /path/to/file.mdx
```
**Solution**: Check file path is correct

### Start Word Not Found

```
⚠️ Warning: Start word 'xyz' not found, starting from beginning
```
**Solution**: Check spelling, or accept starting from beginning

## Advanced Usage

### Progress Monitoring

The converter outputs progress every 100 entries:

```
Processed 100/1000 (100 success, 0 errors)
Processed 200/1000 (200 success, 0 errors)
```

### Unknown Pattern Detection

If the parser reports unknown patterns:

```
⚠️ UNKNOWN PATTERNS DETECTED
Found unknown patterns in 50 entries:

AFTER_CAPTION → div.new-class: 45 occurrences
  Examples: word1, word2, word3
```

This helps you:
1. Identify new HTML structures
2. Update parser to handle them
3. Improve conversion accuracy

## Integration Example

```javascript
// Use converted JSON in your application
import fs from 'fs'

const dictionary = JSON.parse(fs.readFileSync('collins-converted.json', 'utf8'))

// Build search index
const index = {}
dictionary.forEach(entry => {
  index[entry.word.toLowerCase()] = entry
})

// Lookup
function lookup(word) {
  return index[word.toLowerCase()]
}

console.log(lookup('ability'))
```

## Future Enhancements

- [ ] Parallel processing
- [ ] Resume from checkpoint
- [ ] Multiple output formats (SQLite, MongoDB, etc.)
- [ ] Validation and quality checks
- [ ] Deduplication
- [ ] Merge multiple dictionaries

---

For more details, see:
- `/server/lib/collins/parser-ece.js` - Example parser implementation
- `/server/lib/collins/structure-report.md` - HTML structure analysis
- `/server/lib/collins/CONVERSION_SUMMARY.md` - Technical overview

