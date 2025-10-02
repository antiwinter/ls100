# Collins Advanced English-Chinese Dictionary (ECE)

Research findings and parser documentation for the Collins Advanced ECE dictionary.

---

## Quick Reference

### MDict File Format

**MDX** (MDict Dictionary)
- Dictionary text content in binary format
- Accessed via `js-mdict` library: `const mdx = new MDX('Collins-Advanced-ECE.mdx')`
- Lookup: `mdx.lookup('word')` returns `{definition: '<html>...'}` 

**MDD** (MDict Data)
- Optional resources: CSS, images, audio
- For ECE: Only contains `collins.css` (5KB) and small icons

---

## Dictionary Overview

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

---

## HTML Structure

### Standard Entry Pattern (85%+ of entries)

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

### Key HTML Classes

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

---

## Special Patterns

### 1. Nested Usage Notes (~55 entries)

Usage notes can contain nested examples:

```html
<ul>
  <li class="en_tip">
    <p>Usage note text</p>
    <ul class="vli">
      <li><p>Nested example 1</p><p>中文翻译1</p></li>
      <li><p>Nested example 2</p><p>中文翻译2</p></li>
    </ul>
  </li>
</ul>
```

**Parser handling:** `IN_USAGE_NOTE` → `IN_USAGE_EXAMPLES` → `IN_USAGE_EXAMPLE` states

**Output format:**
```json
{
  "usageNote": "Usage note text",
  "exs": [
    {"en": "Nested example 1", "zh": "中文翻译1"},
    {"en": "Nested example 2", "zh": "中文翻译2"}
  ]
}
```

### 2. Related Phrases (769 entries)

Cross-references to related phrasal verbs or compounds:

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

**Parser handling:** `IN_RELATED` state extracts linked phrases

**Output as:** `refTo: ["close down", "close off"]`

**Note:** 2 entries have multiple phrase groups, which are merged into one flat array.

### 3. See Also References

Simple cross-references without definitions:

```html
<span class="st">
  See also:
  <a href="entry://self-appointed">self-appointed</a>
</span>
```

**Parser handling:** Detects "See also:" as POS, extracts linked words to `refTo`

**Output:** Definition is skipped, only `refTo` is populated

### 4. Labels (STYLE/FIELD/REGION)

Metadata labels appear in definitions:

```html
【STYLE标签】：FORMAL 正式
【语域标签】：BRIT 英
【FIELD标签】：MEDICAL 医学
```

**Parser handling:** `extractLabels()` extracts English labels, drops Chinese

**Output:**
```json
{
  "labels": ["FORMAL"],  // or ["BRIT"], ["MEDICAL"], etc.
  "en": "Definition text..."  // labels removed from definition
}
```

**Label combinations:** "FORMAL or HUMOROUS" → split to `["FORMAL", "HUMOROUS"]`

### 5. Grammar Information

Grammar patterns embedded in definitions:

```html
【语法信息】：V n
【搭配模式】：usu pl
【语用信息】：with brd-neg
```

**Parser handling:** `extractGrammarInfo()` finds and moves to POS field

**Output:**
```json
{
  "pos": "VERB, V n",  // Grammar appended to POS
  "en": "Definition..."  // Grammar info removed
}
```

---

## Parser Implementation

### State Machine

The parser (`parser-ece.js`) uses a state machine to track position in HTML:

**Main states:**
- `INIT` → Document start
- `IN_CONTENT` → Inside main content area
- `AFTER_CAPTION` → After a definition header
- `IN_CAPTION` → Processing definition header
- `IN_POS` → Extracting part of speech
- `IN_ZH` → Collecting Chinese text
- `IN_EXAMPLE` → Processing example sentence
- `IN_EX_EN` → English part of example
- `IN_EX_ZH` → Chinese part of example
- `IN_USAGE_NOTE` → Processing usage note
- `IN_USAGE_EXAMPLES` → List of nested examples
- `IN_USAGE_EXAMPLE` → Individual nested example
- `IN_RELATED` → Extracting related phrases

### Key Methods

**`parsePOS(text)`**
- Splits bilingual POS at first Chinese character
- Detects "See also:" entries
- Sets `currentDef.pos` and `currentDef.posZh`

**`extractGrammarInfo()`**
- Finds 【语法信息】, 【搭配模式】, 【语用信息】 patterns
- Appends to `currentDef.pos`
- Removes from `currentDef.en`

**`extractLabels()`**
- Finds 【STYLE标签】, 【语域标签】, 【FIELD标签】 patterns
- Extracts English labels only
- Splits combinations like "FORMAL or HUMOROUS"
- Populates `currentDef.labels`

**`extractInlineReferences()`**
- Handles mixed definitions with "See also:" inline
- Extracts cross-references without preventing definition from being added

**`finishDefinition()`**
- Finalizes current definition
- Adds to `result.defs` or `result.refTo` based on type
- Calls extraction methods

### Text Buffer Management

**Critical for correct parsing:**
- `textBuffer` accumulates text within a state
- Cleared only when block-level element ends
- Inline elements (`<b>`, `<i>`, `<span>`) don't clear buffer
- Join without extra spaces: `.join('').replace(/\s+/g, ' ').trim()`

---

## JSON Output Format

```json
{
  "word": "abandon",
  "defs": [
    {
      "pos": "VERB, V n",
      "posZh": "动词",
      "en": "If you abandon a place, thing, or person, you leave...",
      "zh": "离弃；遗弃；抛弃",
      "labels": ["FORMAL"],
      "exs": [
        {
          "en": "He claimed that his parents had abandoned him.",
          "zh": "他声称父母遗弃了他。"
        }
      ],
      "usageNote": "Usage text here",
      "exs": [
        {"en": "nested example", "zh": "嵌套例句"}
      ]
    }
  ],
  "refTo": ["abandoned", "abandonment"],
  "ipa": "...",
  "thesaurus": {...},
  "origin": "...",
  "quotes": [...]
}
```

**Field descriptions:**
- `word` (required): The headword
- `defs` (required): Array of definitions
  - `pos` (required): English part of speech + grammar info
  - `posZh` (optional): Chinese part of speech
  - `en` (required): English definition
  - `zh` (optional): Chinese definition
  - `labels` (optional): Array of metadata labels
  - `exs` (optional): Array of example sentences
  - `usageNote` (optional): Usage note text
- `refTo` (optional): Array of cross-referenced words/phrases
- `ipa`, `thesaurus`, `origin`, `quotes` (optional): Reserved for future use

---

## Validation

### Golden Rule Validator (Generic)

**File:** `../validate-json.js` (root level)

**Purpose:** Parser-agnostic JSON quality checker - the golden rule all parsers must pass

**Checks:**
1. **Structure**: Valid JSON with required fields (`word`, `defs[]`)
2. **POS Split**: No Chinese characters in English `pos` field
3. **RefTo Format**: Flat string array, not nested objects
4. **Labels Extracted**: No label markers (`】`) left in JSON
5. **Statistics**: Reports entries with labels

**Run:**
```bash
node validate-json.js Collins-Advanced-ECE/samples/1000.json
```

### ECE Development Validator (Parser-Specific)

**File:** `validate-ece-vs-mdx.js` (ECE directory)

**Purpose:** Development tool for ECE parser tuning - compares JSON to MDX/HTML

**Additional checks:**
1. **Chinese Text**: Ensures examples have `zh` field when in MDX
2. **Nested Examples**: Compares nested structure to MDX
3. **Definition Count**: Compares MDX vs JSON counts
4. **Label Extraction**: Verifies labels found in MDX are extracted

**Run:**
```bash
cd Collins-Advanced-ECE
node validate-ece-vs-mdx.js samples/1000.json
```

**Note:** This validator requires MDX access and is for development only.

---

## MDD Resources

**File:** `Collins-Advanced-ECE.mdd` (7.2KB)

**Contents:**
- `collins.css` - Stylesheet (5KB)
- Small PNG icons (16x16, 32x32)
- No audio, no large images

**Decision:** Resources are minimal and not critical. Not implementing full MDD support.

---

## Usage

### Convert Sample (1000 entries)

```bash
cd /Users/warits/code/ls100/research/mdict
./convert-v2.js /Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx \
  --parser=ece \
  --start=abandon \
  -c 1000 \
  -o Collins-Advanced-ECE/samples/collins-ece-1000-abandon.json
```

### Convert Full Dictionary

```bash
./convert-v2.js /Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx \
  --parser=ece \
  -o Collins-Advanced-ECE/collins-ece-full.json
```

**Estimated time:** ~1 hour  
**Estimated size:** ~30 MB JSON for 36k entries

### Validate Output

```bash
cd Collins-Advanced-ECE
node validate-conversion.js
```

### Analyze MDX Structure

```bash
cd Collins-Advanced-ECE
node analyze-mdx-structure.js
```

---

## Known Issues & Solutions

### ✅ FIXED: POS Parsing

**Problem:** Splitting on whitespace failed for multi-word POS like "COMB in ADJ-GRADED"

**Solution:** Split at first Chinese character using regex:
```javascript
const match = text.match(/^([^\u4e00-\u9fa5]+)([\u4e00-\u9fa5].*)$/)
```

### ✅ FIXED: Chinese Text in Examples

**Problem:** `textBuffer` cleared prematurely, losing Chinese translations

**Solution:** Only clear buffer when block-level elements end, not inline elements

### ✅ FIXED: Word-breaking in Highlights

**Problem:** Highlighted words split incorrectly (e.g., "abandon ed")

**Solution:** Join text buffer without extra spaces, normalize whitespace at end

### ✅ FIXED: Nested Examples

**Problem:** Usage notes with nested examples lost content

**Solution:** Refined state transitions, only finalize when `<li>` closes

### ✅ FIXED: RefTo Structure

**Problem:** `refTo` was `[{phrases: [...]}]` instead of flat array

**Solution:** Flatten in `finish()` method, merge all phrase arrays

### ✅ FIXED: Labels in Definitions

**Problem:** Labels not extracted, left in definition text

**Solution:** Implemented `extractLabels()` with proper regex matching

---

## Statistics

### Label Types (from 1000 sample)

**STYLE Labels (18 unique):**
- FORMAL, INFORMAL, WRITTEN, SPOKEN
- HUMOROUS, LITERARY, OLD-FASHIONED
- Combinations: "FORMAL or HUMOROUS", etc.

**REGION Labels (4 unique):**
- BRIT, AM
- mainly BRIT, mainly AM

**FIELD Labels (2 unique):**
- MEDICAL, BUSINESS, COMPUTING, JOURNALISM, LEGAL, TECHNICAL
- DIALECT (style/region hybrid)

**Total unique labels:** 24 (including combinations)

**Coverage:** ~200 entries (20%) in 1000 sample have labels

---

## Conversion Quality

**Latest validation (1000 entries):**
- ✅ 100% pass rate
- ✅ All Chinese translations present
- ✅ POS correctly split
- ✅ Labels extracted and removed
- ✅ RefTo flattened
- ✅ Nested examples preserved
- ✅ Definition counts match MDX

**Unknown patterns:** ~150 entries have minor unknown HTML patterns (mostly formatting variations), but these don't affect data extraction.

---

## Files

```
Collins-Advanced-ECE/
├── findings.md                    # This file
├── parser-ece.js                  # Parser implementation
├── analyze-mdx-structure.js       # MDX analysis tool
├── validate-ece-vs-mdx.js        # ECE-specific validator (dev tool)
├── label-analysis.md             # Label types documentation
├── PARSER_ECE_COMPLETE.md        # Detailed parser docs
└── samples/
    └── 1000.json                  # 1000 entry sample

../validate-json.js                # Generic JSON validator (golden rule)
```

---

## Next Steps

1. ✅ Parser complete and validated
2. ⏳ Run full conversion (36k entries)
3. ⏳ Build search index from JSON
4. ⏳ Integrate into main application

