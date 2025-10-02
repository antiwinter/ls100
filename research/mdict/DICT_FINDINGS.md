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
- **Status**: ✅ Parser implemented (`parser-ece.js`)

### Entry Statistics

**From full dictionary scan (36,330 entries):**

| Metric | Value |
|--------|-------|
| Total entries | 36,330 |
| Entries with Chinese | 96%+ |
| Entries with examples | 77%+ |
| Entries with POS tags | 100% |
| Avg definitions/word | 2.8 |
| Avg examples/def | 1.4 |
| Entries with `<dl>` (related phrases) | 769 (2.1%) |
| Entries with multiple `<dl>` | 2 ("close", "fire") |
| Max definitions per word | 20+ |

### HTML Structure

#### Standard Entry Pattern (85%+ of entries)

```html
<div class="collins_en_cn">
  <div class="caption">
    <span class="num">1.</span>
    <span class="st">NOUN	名词</span>
    <span class="text_blue">中文词性说明</span>
    English definition text...
  </div>
  <ul>
    <li>
      <p>English example sentence</p>
      <p>中文例句翻译</p>
    </li>
  </ul>
</div>
```

#### Key HTML Classes

| Class | Purpose |
|-------|---------|
| `.collins_en_cn` | Definition section container |
| `.caption` | Definition header (POS + definition) |
| `.num` | Definition number |
| `.st` | Part of speech (bilingual) |
| `.text_blue` | Chinese text |
| `ul > li > p` | Example sentences |
| `<dl>` | Related phrases section |
| `.en_tip` | Usage notes (nested examples) |

### Special Patterns

#### 1. Nested Usage Notes (~55 entries)

```html
<ul>
  <li class="en_tip">
    <p>Usage note text</p>
    <ul>
      <li><p>Nested example 1</p></li>
      <li><p>Nested example 2</p></li>
    </ul>
  </li>
</ul>
```

**Handled by:** `IN_USAGE_NOTE` state in parser

#### 2. Related Phrases (769 entries)

```html
<div class="caption">
  <dl>
    <dt>相关词组：</dt>
    <dd>
      <a href="entry://close down">close down</a>
      <a href="entry://close off">close off</a>
    </dd>
  </dl>
</div>
```

**Output as:** `refTo: [{phrases: ["close down", "close off"]}]`

**Note:** 2 entries have multiple `<dl>` sections (different phrase groups):
- "close": ["close down", "close off", "close up"] + ["close in"]
- "fire": ["fire up"] + ["fire away", "fire off"]

#### 3. See Also References

```html
<span class="st">
  See also:
  <a href="entry://self-appointed">self-appointed</a>
</span>
```

**Parsed as:** `pos: "See also:"`, `posZh: ""`

### Known Issues & Fixes Needed

#### Issue 1: POS Parsing ❌ CRITICAL

**Problem:**
Current code splits POS on whitespace, but English POS can contain spaces:

```
Input: "COMB in ADJ-GRADED	与形容词构成的词"
Current: pos="COMB", posZh="in ADJ-GRADED 与形容词构成的词"  ❌
Correct: pos="COMB in ADJ-GRADED", posZh="与形容词构成的词"  ✅
```

**Root Cause:**
Format is `<English POS><tab/space><Chinese POS>`, but English POS itself can have spaces.

**Solution:**
Split at first Chinese character (U+4E00-U+9FA5):

```javascript
// In parser-ece.js, parsePOS() method (line ~390)
parsePOS(text) {
  // Clean junk characters
  text = text.replace(/[\r\n<>]/g, '').trim()
  
  // Split at first Chinese character
  const match = text.match(/^([^\u4e00-\u9fa5]+)([\u4e00-\u9fa5].*)$/)
  
  if (match) {
    this.currentDef.pos = match[1].trim()    // Everything before Chinese
    this.currentDef.posZh = match[2].trim()  // Chinese part onwards
  } else {
    this.currentDef.pos = text
    this.currentDef.posZh = ''
  }
}
```

**Impact:** Affects ~400 entries with multi-word POS tags

#### Issue 2: RefTo Structure ✅ CORRECT

**Question:** Can we flatten `refTo: [{phrases: [...]}, {phrases: [...]}]` to `refTo: [...]`?

**Answer:** No, keep nested structure.

**Reasoning:**
- Full scan found only 2 entries with multiple `<dl>` sections
- Each section is a separate definition area
- Grouping has semantic meaning (authorial intent)
- Minimal storage cost
- Preserves structure for 0.005% of entries

### MDD Resources

**File:** `Collins-Advanced-ECE.mdd` (7.2K)

**Contents:**
- `collins.css` - Stylesheet (5KB)
- Small PNG icons (16x16, 32x32)
- No audio, no large images

**Usage in HTML:**
```html
<link href="collins.css" rel="stylesheet" type="text/css" />
```

**Note:** Current server implementation strips CSS references (see `/server/lib/collins/index.js`)

**Decision:** MDD resources are minimal and not critical. Not implementing full MDD support.

### Conversion Recommendations

1. **Fix POS parsing** (critical) ✅
2. **Keep refTo nested** (correct as-is) ✅
3. **Handle unknown patterns** (ongoing)
4. **Full extraction**: Run after POS fix
   ```bash
   ./convert-v2.js Collins-Advanced-ECE.mdx -o collins-ece-full.json
   ```
5. **Estimated output**: ~30 MB JSON for 36k entries
6. **Time**: ~1 hour

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
- **Content**: Combined dictionary + thesaurus
- **Status**: ⚠️ Parser in progress (`parser-2015.js`)

### Key Differences from ECE

1. **Dual Content**: Dictionary AND Thesaurus in same entry
   - Tab interface: "Dictionary" and "Thesaurus"  
   - `.c1a` → `.fvv` (tabs) + `.dxr` (dict) + `.tvr` (thesaurus)

2. **Additional Data Fields**:
   - Pronunciation with IPA: `/əˈbɪlɪtɪ/`
   - Audio buttons: `<img onclick="aes(...)">` 
   - Quotations section: Famous quotes related to word
   - Etymology/Origin: Detailed word history
   - Derived forms: Related word formations

3. **Different HTML Structure**:
   - Top wrapper: `.c1a` (not `.dxr` directly)
   - Headword: `.f9d` (simple) or `.quf` (with pronunciation)
   - Thesaurus classes: `.xf7`, `.fxr`, `.aox`, etc.
   
4. **More Complex**: 
   - 190k entries vs 36k (ECE)
   - Richer metadata
   - Mixed dictionary/thesaurus content

### HTML Structure Pattern

```html
<div class="c1a">
  <div class="fvv">              <!-- Tabs: Dictionary | Thesaurus -->
    <span class="dzf">Dictionary</span>
    <span class="t3h">Thesaurus</span>
  </div>
  
  <div class="dxr">              <!-- Dictionary content -->
    <div id="ability_1">         <!-- Entry wrapper -->
      <div class="j84">          <!-- Entry block -->
        <h2 class="quf">ability <span class="kf5">/əˈbɪlɪtɪ/</span></h2>
        <div class="mh1">        <!-- Main content -->
          <div class="x5z">      <!-- POS section -->
            <h4 class="jnw"><span class="sg0">noun</span></h4>
            <div class="oyu">
              <div class="iji">  <!-- Definition item -->
                <span class="sd9">possession of the qualities...</span>
                <div><span class="k75">⇒</span> <span class="u9w"><q>example</q></span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="roj">Origin...</div>
      </div>
    </div>
  </div>
  
  <div class="tvr">              <!-- Thesaurus content -->
    ...synonyms, antonyms...
  </div>
</div>
```

### Parser Status

**Current**: ⚠️ Basic structure parsing works, but not extracting definitions yet

**Issues to resolve**:
1. Thesaurus content mixing with dictionary content
2. State machine needs refinement for deeper nesting
3. Need to handle dual-tab structure
4. Need to decide if we extract thesaurus data

**JSON Format Challenge**:
Our standard format doesn't have fields for:
- `pronunciation` (IPA notation)
- `origin` (etymology)
- `quotations` (famous quotes)
- `thesaurus` (synonyms/antonyms)

**Options**:
1. **Extend format**: Add optional fields for 2015-specific data
2. **Separate parsers**: One for dict, one for thesaurus
3. **Skip extra data**: Only extract standard def/examples

**Recommendation**: Complete ECE parser first, then revisit 2015 with lessons learned

---

## 2015 Dictionary: Extended JSON Format

### Analysis of New Fields

**Tabs**: Dictionary + Thesaurus interface
- **Frequency**: Present in ~50-70% of entries (main words only)
- **Not in**: Affixes (-able, -ing), technical terms, some compounds
- **Content**: Both dictionary and thesaurus data when present

**What tabs are**: UI elements showing two types of content
```html
<div class="fvv">
  <span class="dzf">Dictionary</span>  <!-- Tab 1 -->
  <span class="t3h">Thesaurus</span>   <!-- Tab 2 -->
</div>
<div class="dxr">...dictionary content...</div>
<div class="tvr">...thesaurus content...</div>
```

### Proposed Extended JSON Format

```json
{
  "word": "happy",
  "ipa": "/ˈhæpi/",           // IPA pronunciation (optional)
  "defs": [                    // Dictionary definitions (required)
    {
      "pos": "adjective",
      "en": "feeling, showing, or expressing joy; pleased",
      "exs": [
        {"en": "I'm just happy to be back running"}
      ]
    }
  ],
  "thesaurus": {               // Thesaurus data (optional, separate section)
    "adjective": [             // Grouped by POS
      {
        "syno": ["pleased", "delighted", "content", "thrilled", ...],
        "anto": ["sad"]
      },
      {
        "syno": ["contented", "blessed", "joyful", ...],
        "anto": ["discontent"]
      }
    ]
  },
  "origin": "Old English...",  // Etymology (optional)
  "quotes": [                  // Famous quotations (optional)
    {
      "text": "Happy men are grave...",
      "author": "Publilius Syrus"
    }
  ],
  "refTo": []                  // Cross-references (standard)
}
```

### Why This Structure?

1. **`ipa` at entry level**: One pronunciation per word ✅
2. **`thesaurus` separate from `defs`**: 
   - ❌ NOT per-definition (they don't align 1:1)
   - Dictionary: 7 definitions, Thesaurus: 4 groups (for "happy")
   - Groups by POS, then by sense
3. **`origin` at entry level**: One etymology per word ✅
4. **`quotes` at entry level**: Related to word as whole, not specific definitions ✅

### Coverage Check

Does this cover all 2015 requirements?

| Feature | Field | Status |
|---------|-------|--------|
| Pronunciation | `ipa` | ✅ Covered |
| Etymology | `origin` | ✅ Covered |
| Quotations | `quotes` | ✅ Covered |
| Synonyms | `thesaurus[pos][n].syno` | ✅ Covered |
| Antonyms | `thesaurus[pos][n].anto` | ✅ Covered |
| Tabs | N/A | UI element, not data |
| Audio buttons | N/A | External resource |

**Answer**: ✅ Yes, this covers all 2015 content requirements!

### Parser Status (2015)

⚠️ **Work in Progress**: The 2015 parser (`parser-2015.js`) is partially implemented but not yet working correctly.

**Issues**:
- Parser enters states but doesn't extract definitions
- Dictionary and thesaurus sections may be confused
- State transitions need debugging

**Next Steps**:
1. Debug state machine transitions with detailed logging
2. Verify `.dxr` vs `.tvr` container handling
3. Test with simpler entries first
4. Add unit tests for state transitions

**Recommendation**: Complete and verify ECE parser first, then return to 2015 parser with lessons learned.

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

### Generated Files

All research outputs in `1/` directory:

```
1/
├── Collins-Advanced-ECE/
│   ├── mdx/              # Extracted HTML (sample entries)
│   └── mdd/              # Extracted resources
├── Collins-Advanced-EE-3th/
│   └── mdx/
├── collins-ece-1000.json       # Sample output (1000 entries)
├── collins-ece-v2-1000.json    # Sample output (v2 parser)
└── _structure_analysis.json    # HTML pattern analysis
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
- ✅ Well understood
- ✅ Parser implemented (with 1 bug to fix)
- ✅ Ready for full conversion

**Other Dictionaries:**
- ❌ Not yet analyzed
- ⏳ Require separate parsers
- ⏳ Future work

**MDD Resources:**
- Minimal content (CSS + small icons)
- Not critical for core functionality
- Can be safely ignored for now

