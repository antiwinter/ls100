# 2015 Parser Implementation Status

## ✅ Phase 1: Complete (Foundation & Debug Setup)

### Completed Tasks

1. **Implementation Plan** (`IMPLEMENTATION_PLAN.md`)
   - 5 phases mapped out
   - 8 iterations defined
   - Testing strategy documented
   - Est. 10-13 hours total

2. **Debug Tools Created**
   - `extract-sample.js` - Extract HTML for specific words
   - `analyze-structure.js` - Analyze HTML patterns
   - `test-single.js` - Test parser on single word

3. **Samples Extracted**
   - `ability.html` (9.1 KB) - Complete entry
   - `happy.html` (14.7 KB) - Multiple POS
   - `a.html` (15.8 KB) - Simple article
   - `run.html` (59.2 KB) - Complex, many defs
   - `love.html` (28.9 KB) - Noun + verb

4. **Structure Analysis Complete**

**Key findings:**
```
Main containers:
  .c1a  - Root container (1 per entry)
  .fvv  - Tabs (Dict/Thesaurus)
  .dxr  - Dictionary section
  .tvr  - Thesaurus section
  .roj  - Origin/etymology (1-2 per entry)
  .exq  - Quotes section

Dictionary parsing:
  .j84  - Entry blocks
  .quf  - Headword with IPA
  .kf5  - IPA pronunciation (inside .quf)
  .x5z  - POS section (multiple per entry)
  .jnw  - POS header
  .sg0  - POS label (e.g., "noun")
  .iji  - Definition item (multiple per POS)
  .sd9  - Definition text
  .u9w  - Example text
  .k75  - Example arrow (⇒)

Statistics from "ability":
  - 3 POS sections
  - 7 definition items
  - 13 examples
  - 1 IPA
  - 2 origin sections
  - 1 quotes section
```

---

## ⏳ Phase 2: In Progress (Parser Implementation)

### Current State

Parser skeleton exists (`parser-2015.js`) with:
- ✅ Basic structure
- ✅ Constructor with extended fields
- ✅ State management
- ❌ No actual parsing logic (outputs empty defs)

### Next Steps (8 Iterations)

#### Iteration 1: Basic Dictionary Content (Priority: HIGH)

**Goal:** Extract `word`, `defs[].pos`, `defs[].en`

**Implementation needed:**

```javascript
// Key states to implement:
IN_DICT_ENTRY → IN_HEADWORD → capture word
IN_DICT_ENTRY → IN_POS_SECTION (.x5z) → process POS
IN_POS_SECTION → IN_POS_LABEL (.sg0) → capture pos
IN_POS_SECTION → IN_DEF_ITEM (.iji) → new definition
IN_DEF_ITEM → IN_DEF_TEXT (.sd9) → capture definition text

// Logic:
1. When entering .x5z, create new POS section
2. When in .sg0, capture POS text (e.g., "noun")
3. When in .iji, create new definition with current POS
4. When in .sd9, capture definition text
5. finishDefinition() adds to result.defs
```

**Test:** `node test-single.js ability` should show defs with pos and en

#### Iteration 2: Examples

**Goal:** Extract `defs[].exs[]`

**Implementation:**
```javascript
// States:
IN_DEF_ITEM → IN_EXAMPLE_SECTION → detect example container
IN_EXAMPLE_SECTION → IN_EXAMPLE (.u9w) → capture example text

// Logic:
1. Examples follow definitions
2. .u9w contains example text inside <q> tag
3. Add to currentDef.exs[]
```

#### Iteration 3: IPA Pronunciation

**Goal:** Extract `ipa` field

**Implementation:**
```javascript
// States:
IN_HEADWORD → IN_IPA (.kf5) → capture IPA

// Logic:
1. Look for .kf5 inside .quf (headword)
2. Extract text like "/əˈbɪlɪtɪ/"
3. Set result.ipa
```

#### Iteration 4: Origin/Etymology

**Goal:** Extract `origin` field

**Implementation:**
```javascript
// States:
IN_ROOT → IN_ORIGIN (.roj) → capture origin text

// Logic:
1. .roj can appear multiple times
2. Concatenate all origin text
3. Set result.origin
```

#### Iteration 5-6: Thesaurus

**Goal:** Extract `thesaurus.{pos}[].syno[]` and `.anto[]`

**Implementation:**
```javascript
// States:
IN_ROOT → IN_THES_CONTAINER (.tvr) → entering thesaurus
IN_THES_CONTAINER → IN_THES_POS_SECTION → group by POS
IN_THES_POS_SECTION → IN_SYNO_GROUP → synonyms
IN_THES_POS_SECTION → IN_ANTO_GROUP → antonyms

// Logic:
1. Thesaurus section (.tvr) separate from dictionary
2. Group synonyms/antonyms by POS
3. Each POS can have multiple sense groups
4. Structure: thesaurus.noun[{syno:[], anto:[]}]
```

#### Iteration 7: Quotations

**Goal:** Extract `quotes[]`

**Implementation:**
```javascript
// States:
IN_ROOT → IN_QUOTES_SECTION (.exq) → quotes container
IN_QUOTES_SECTION → IN_QUOTE → individual quote
IN_QUOTE → capture text and author

// Logic:
1. Each quote has text + author
2. Add to result.quotes[]
```

#### Iteration 8: Cross-references

**Goal:** Extract `refTo[]` (flat array)

**Similar to ECE parser**

---

## ⏳ Phase 3: Validation & Quality

### Tasks Needed

1. **Update Generic Validator** (`validate-json.js`)

Add checks for optional fields:

```javascript
// Check 5: IPA format (if present)
if (entry.ipa) {
  if (typeof entry.ipa !== 'string' || !/^\/.*\/$/.test(entry.ipa)) {
    issues.push({ word, field: 'ipa', reason: 'Invalid IPA format' })
  }
}

// Check 6: Thesaurus structure (if present)
if (entry.thesaurus && Object.keys(entry.thesaurus).length > 0) {
  for (const pos in entry.thesaurus) {
    if (!Array.isArray(entry.thesaurus[pos])) {
      issues.push({ word, field: 'thesaurus', reason: `${pos} not array` })
    }
    // Check each group has syno or anto
    entry.thesaurus[pos].forEach((group, i) => {
      if (!group.syno && !group.anto) {
        issues.push({ word, field: 'thesaurus', reason: `${pos}[${i}] missing syno/anto` })
      }
    })
  }
}

// Check 7: Origin format (if present)
if (entry.origin && typeof entry.origin !== 'string') {
  issues.push({ word, field: 'origin', reason: 'Not a string' })
}

// Check 8: Quotes structure (if present)
if (entry.quotes && Array.isArray(entry.quotes)) {
  entry.quotes.forEach((quote, i) => {
    if (!quote.text || typeof quote.text !== 'string') {
      issues.push({ word, field: 'quotes', reason: `quotes[${i}] missing text` })
    }
    if (!quote.author || typeof quote.author !== 'string') {
      issues.push({ word, field: 'quotes', reason: `quotes[${i}] missing author` })
    }
  })
}

// Statistics
if (entry.ipa) stats.withIPA++
if (Object.keys(entry.thesaurus || {}).length > 0) stats.withThesaurus++
if (entry.origin) stats.withOrigin++
if (entry.quotes && entry.quotes.length > 0) stats.withQuotes++
```

2. **Create 2015-Specific Validator**

`Collins-EDnT-2015/validate-2015-vs-mdx.js` - compares JSON to MDX

---

## ⏳ Phase 4: Documentation

### Tasks Needed

1. **Update `CONVERTER.md`**

Add section documenting extended JSON format:

```markdown
## Extended JSON Format (2015 Edition)

In addition to standard fields, the 2015 parser extracts:

### IPA Pronunciation (optional)

```json
{
  "word": "ability",
  "ipa": "/əˈbɪlɪtɪ/"
}
```

### Thesaurus Data (optional)

Grouped by part of speech, with multiple sense groups per POS:

```json
{
  "thesaurus": {
    "noun": [
      {
        "syno": ["capability", "capacity", "power"],
        "anto": ["inability", "incapacity"]
      }
    ],
    "adjective": [
      {
        "syno": ["able", "capable"],
        "anto": ["unable"]
      }
    ]
  }
}
```

### Etymology/Origin (optional)

```json
{
  "origin": "Old English abilite, from Latin habilitatem..."
}
```

### Famous Quotations (optional)

```json
{
  "quotes": [
    {
      "text": "Happy men are grave.",
      "author": "Publilius Syrus"
    }
  ]
}
```

### Coverage

- **IPA**: ~70% of entries (main words only)
- **Thesaurus**: ~50% of entries (substantive words)
- **Origin**: ~30% of entries (established words)
- **Quotes**: ~5% of entries (notable words)
```

2. **Update Field Reference**

Add to standard field documentation:

| Field | Type | Optional | Dictionary | Description |
|-------|------|----------|------------|-------------|
| `ipa` | string | Yes | 2015 | IPA pronunciation notation |
| `thesaurus` | object | Yes | 2015 | Synonyms/antonyms by POS |
| `origin` | string | Yes | 2015 | Etymology/word history |
| `quotes` | array | Yes | 2015 | Famous quotations |

---

## ⏳ Phase 5: Full Conversion

```bash
# Sample (1000 entries, ~10 minutes)
./convert-v2.js dict.mdx --parser=2015 -c 1000 -o samples/1000.json
node validate-json.js samples/1000.json

# Full (190k entries, ~2-3 hours)
./convert-v2.js dict.mdx --parser=2015 -o collins-2015-full.json
node validate-json.js collins-2015-full.json
```

**Expected output:**
- 190,727 entries
- ~80-100 MB file
- 95%+ validation pass rate

---

## Summary

**Completed:**
- ✅ Phase 1: Foundation & Debug Setup (100%)

**In Progress:**
- ⏳ Phase 2: Parser Implementation (0%)
  - Skeleton exists, needs logic
  - 8 iterations to implement
  - Estimated 4-6 hours

**Remaining:**
- ⏳ Phase 3: Validation (est. 1-2 hours)
- ⏳ Phase 4: Documentation (est. 1 hour)
- ⏳ Phase 5: Full conversion (est. 3 hours)

**Total remaining: 9-12 hours**

---

## Immediate Next Step

**Implement Iteration 1** (Basic Dictionary Content):

```bash
# 1. Start implementing parser logic in parser-2015.js
# 2. Focus on IN_DICT_ENTRY states
# 3. Test with: node test-single.js ability
# 4. Should output defs with pos and en fields
# 5. Iterate until working
```

Once Iteration 1 works, the rest follows the same pattern!

