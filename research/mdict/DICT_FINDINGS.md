# Dictionary Research Findings

Research findings about MDict file formats and Collins dictionaries.

---

## MDict File Format

### What is MDX/MDD?

**MDX** (MDict Dictionary)
- Dictionary text content
- Binary format containing word entries and HTML definitions
- Compressed using various algorithms
- Accessed via `js-mdict` library

**MDD** (MDict Data)
- Resources: CSS, images, audio, fonts
- Binary format, content-addressable
- Optional companion to MDX
- Usually much smaller than MDX

### File Structure

```
dictionary.mdx          # Main file (required)
  ├─ Header             # Metadata
  ├─ Keyword index      # Word list
  └─ Record data        # HTML definitions

dictionary.mdd          # Resources (optional)
  ├─ Header
  ├─ Resource index
  └─ Resource data      # Binary files
```

### How to Read

```javascript
import { MDX, MDD } from 'js-mdict'

// Load dictionary
const mdx = new MDX('dictionary.mdx')
const mdd = new MDD('dictionary.mdd')

// Get all words
const keywordList = mdx.keywordList  // Array of {keyText: 'word', ...}

// Lookup definition
const result = mdx.lookup('ability')
console.log(result.definition)  // HTML string

// Get resource
const cssData = mdd.locate('collins.css')
```

---

## Collins Dictionaries Overview

### Available Files

Located in `/server/lib/collins/`:

| File | Size | Description |
|------|------|-------------|
| `Collins-Advanced-ECE.mdx` | 13M | English-Chinese (ECE) |
| `Collins-Advanced-ECE.mdd` | 7.2K | ECE resources |
| `Collins-Advanced-EE-3th.mdx` | 7.4M | English-English 3rd ed |
| `Collins-Advanced-EE-3th.mdd` | 5.4K | EE resources |
| `Collins-Thesaurus.mdx` | 910K | Thesaurus |
| `Collins-Usage.mdx` | 779K | Usage guide |
| `Collins English Dictionary and Thesaurus, 2015.mdx` | 44M | Combined 2015 edition |

### Statistics Summary

| Dictionary | Entries | Avg Defs | With ZH | With Examples | Parser |
|------------|---------|----------|---------|---------------|--------|
| ECE | 36,330 | 2.8 | 96%+ | 77%+ | ✅ `parser-ece.js` |
| EE-3th | ~35,000 | 2.5 | 0% | 75%+ | ❌ Not yet |
| Thesaurus | ~12,000 | - | 0% | - | ❌ Not yet |
| Usage | ~500 | - | 0% | - | ❌ Not yet |
| 2015 | ~80,000 | - | 0% | - | ❌ Not yet |

---

## Collins-Advanced-ECE (English-Chinese)

### Overview

- **Full name**: Collins Advanced English-Chinese Dictionary
- **Entries**: 36,330
- **Language**: Bilingual (English → Chinese)
- **Target**: Advanced learners
- **Status**: ✅ Parser complete and validated

### Key Features

- Bilingual definitions (English → Chinese)
- Part of speech tags (bilingual)
- Example sentences with translations
- Usage notes with nested examples
- Related phrases (cross-references)
- Metadata labels (STYLE, REGION, FIELD)
- Grammar patterns

### Parser Status

✅ **Complete** - See `Collins-Advanced-ECE/` directory for:
- `parser-ece.js` - Parser implementation
- `findings.md` - Detailed documentation
- `validate-conversion.js` - Quality checks
- `samples/` - Sample outputs

### Quality Metrics (1000 entry validation)

- ✅ 100% validation pass rate
- ✅ All data fields correctly extracted
- ✅ Nested structures preserved
- ✅ Labels extracted and cleaned
- ✅ Cross-references flattened

### Next Steps

1. ⏳ Run full conversion (36k entries)
2. ⏳ Build search index
3. ⏳ Integrate into application

---

## Collins-Advanced-EE-3th (English-English)

### Overview

- **Full name**: Collins Advanced English-English Dictionary 3rd Edition
- **Entries**: ~35,000 (estimated)
- **Language**: Monolingual (English only)
- **Status**: ❌ Parser not implemented

### Differences from ECE

1. **No Chinese text**
   - No `posZh` or `zh` fields
   - Examples in English only

2. **Different HTML classes**
   - Uses some different CSS classes
   - Structure similar but not identical

3. **More concise definitions**
   - Fewer examples per definition
   - More direct explanations

### HTML Structure (Sample)

```html
<div class="tab_content">
  <div class="part_main">
    <div class="vExplain_s">
      <div class="caption">
        <span class="st">NOUN</span>
        Definition text...
      </div>
      <ul>
        <li><p>Example sentence</p></li>
      </ul>
    </div>
  </div>
</div>
```

### Implementation Status

- ❌ Parser not yet implemented
- ❌ Structure not fully analyzed
- ❌ No conversion available

### Next Steps

1. Extract 100-1000 HTML samples
2. Analyze structure patterns
3. Create `parser-ee.js` based on `parser-ece.js`
4. Test and iterate

---

## Collins-Thesaurus

### Overview

- **Entries**: ~12,000 (estimated)
- **Language**: English
- **Content**: Synonyms, antonyms, related words
- **Status**: ❌ Not implemented

### Structure (Different from Dictionaries)

**Expected output format:**

```json
{
  "word": "ability",
  "synonyms": ["capability", "capacity", "skill"],
  "antonyms": ["inability", "incapacity"],
  "related": ["talent", "aptitude"]
}
```

**Note:** Requires completely different parser than ECE/EE.

---

## Collins-Usage

### Overview

- **Entries**: ~500 (estimated)
- **Content**: Usage notes, grammar tips
- **Status**: ❌ Not analyzed

**Not a priority** - very small, specialized content.

---

## Collins 2015 (Combined Edition)

### Overview

- **Full name**: Collins English Dictionary and Thesaurus, 2015
- **Size**: 44M
- **Entries**: 190,727 (verified)
- **Language**: Monolingual (English)
- **Content**: Combined dictionary + thesaurus
- **Status**: ⚠️ Parser in progress

### Key Features

- Dual content: Dictionary AND Thesaurus
- IPA pronunciation notation
- Etymology/Origin information
- Famous quotations
- Synonyms and antonyms
- Richer metadata than other editions
- ~5x more entries than ECE

### Parser Status

⚠️ **In Progress** - See `Collins-EDnT-2015/` directory for:
- `parser-2015.js` - Parser implementation (WIP)
- `findings.md` - Detailed documentation and challenges
- Extended JSON format proposal

### Key Challenges

1. **Dual content separation**: Dictionary vs Thesaurus in same entry
2. **Extended fields**: IPA, origin, quotes need new JSON structure
3. **Size**: 190k entries (5x ECE)
4. **Complexity**: More nested structures and metadata

### Next Steps

1. ⏳ Debug basic definition extraction
2. ⏳ Implement extended JSON fields
3. ⏳ Add thesaurus data extraction
4. ⏳ Validation and testing

**Priority**: Medium (after ECE completion)

---

## HTML Structure Variations

### Pattern Types Identified

From analyzing 1000+ entries across dictionaries:

**STANDARD** (85%+)
- `.caption` with `.st` and `.text_blue`
- Followed by `<ul>` with examples
- Predictable structure

**NESTED** (55 entries)
- `<li class="en_tip">` usage notes
- Contains nested `<ul>` with examples
- Requires special handling

**PLAINTEXT** (minimal HTML)
- Simple text with minimal markup
- Usually very short entries
- Easy to parse

**NOEXAMPLES** (related phrases only)
- `<dl>` tags without examples
- Just cross-references
- "See also" type entries

**UNKNOWN** (reported by parser)
- New HTML patterns
- Edge cases
- Requires investigation

### Common CSS Classes Across Dictionaries

| Class | Usage | Dictionaries |
|-------|-------|--------------|
| `.collins_en_cn` | ECE section | ECE only |
| `.vExplain_s` / `.vExplain_r` | EE section | EE, 2015 |
| `.caption` | Definition header | All |
| `.st` | Part of speech | All |
| `.text_blue` | Chinese text | ECE only |
| `.num` | Definition number | All |
| `.en_tip` | Usage note | ECE, EE |

---

## Conversion Caveats

### General

1. **HTML Complexity**
   - MDict HTML is not standardized
   - Each dictionary has unique patterns
   - Requires parser per format

2. **CSS References**
   - HTML includes `collins.css` links
   - Must be stripped or handled
   - Currently: server strips them

3. **Internal Links**
   - `<a href="entry://word">` for cross-references
   - Need special handling for navigation
   - Currently: extracted as text only

4. **Encoding**
   - Mix of Unicode and HTML entities
   - cheerio handles most cases
   - Some edge cases may need cleanup

### ECE-Specific

1. **Bilingual POS** - Split at first Chinese char (not whitespace)
2. **Multiple definitions** - Common, handle properly
3. **Nested examples** - Usage notes with sub-examples
4. **Related phrases** - Keep grouped structure
5. **"See also"** - Appears as POS tag, handle specially

### Performance

1. **Memory** - Stable with streaming approach
2. **Speed** - ~10 entries/sec, bottleneck is HTML parsing
3. **Output size** - ~800KB per 1000 entries (ECE)

---

## Future Work

### Immediate (ECE)

1. ✅ Fix POS parsing bug
2. ⏳ Run full conversion (36k entries)
3. ⏳ Build search index from JSON

### Short-term

1. ⏳ Analyze EE-3th structure
2. ⏳ Create `parser-ee.js`
3. ⏳ Convert EE dictionary

### Long-term

1. ⏳ Analyze Thesaurus structure
2. ⏳ Create `parser-thesaurus.js`
3. ⏳ Analyze 2015 combined edition
4. ⏳ Consider audio/pronunciation data (if available)

---

## Research Data

### Directory Structure

```
research/mdict/
├── DICT_FINDINGS.md              # This file (overview)
├── CONVERTER.md                  # Converter documentation
├── convert-v2.js                 # Generic converter script
├── Collins-Advanced-ECE/         # ECE-specific files ✅
│   ├── findings.md               # Detailed ECE documentation
│   ├── parser-ece.js             # ECE parser
│   ├── validate-conversion.js   # Validation script
│   ├── analyze-mdx-structure.js # MDX analysis tool
│   ├── label-analysis.md        # Label types docs
│   ├── PARSER_ECE_COMPLETE.md   # Parser details
│   └── samples/                  # Sample outputs
│       └── collins-ece-1000-abandon.json
├── Collins-EDnT-2015/            # 2015 combined edition ⚠️
│   ├── findings.md               # Detailed 2015 documentation
│   ├── parser-2015.js            # 2015 parser (WIP)
│   └── samples/                  # Sample outputs (when ready)
└── [Other dictionary directories as needed]
```

### Useful Commands

```bash
# Extract single entry
node -e "
  const {MDX} = require('js-mdict');
  const mdx = new MDX('/server/lib/collins/Collins-Advanced-ECE.mdx');
  const result = mdx.lookup('ability');
  console.log(result.definition);
"

# Count entries
node -e "
  const {MDX} = require('js-mdict');
  const mdx = new MDX('dict.mdx');
  console.log(mdx.keywordList.length);
"

# Extract resource
node -e "
  const {MDD} = require('js-mdict');
  const mdd = new MDD('dict.mdd');
  const data = mdd.locate('collins.css');
  console.log(data.toString('utf8'));
"
```

---

## Conclusion

**Collins-Advanced-ECE:**
- ✅ Complete and validated
- ✅ 100% validation pass rate
- ✅ Ready for full conversion (36k entries)
- 📁 All files in `Collins-Advanced-ECE/` directory

**Other Dictionaries:**
- ❌ Not yet analyzed
- ⏳ Require separate parsers
- ⏳ Future work

**MDD Resources:**
- Minimal content (CSS + small icons)
- Not critical for core functionality
- Can be safely ignored for now

**File Organization:**
- Root: Generic converter and overview docs
- Dictionary-specific: Organized in subdirectories
- Clean separation of concerns

