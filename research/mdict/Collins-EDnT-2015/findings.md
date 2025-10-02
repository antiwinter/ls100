# Collins English Dictionary and Thesaurus, 2015

Research findings and parser documentation for the Collins 2015 combined edition.

---

## Quick Reference

### MDict File Format

**MDX** (MDict Dictionary)
- Dictionary text content in binary format
- Accessed via `js-mdict` library: `const mdx = new MDX('Collins English Dictionary and Thesaurus, 2015.mdx')`
- Lookup: `mdx.lookup('word')` returns `{definition: '<html>...'}` 

---

## Dictionary Overview

- **Full name**: Collins English Dictionary and Thesaurus, 2015
- **File size**: 44M
- **Entries**: 190,727 (verified)
- **Language**: Monolingual (English)
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

---

## HTML Structure Pattern

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

---

## Extended JSON Format

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

### Proposed JSON Structure

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

---

## Parser Status

⚠️ **Work in Progress**: The 2015 parser (`parser-2015.js`) is partially implemented but not yet working correctly.

### Current Issues

- Parser enters states but doesn't extract definitions
- Dictionary and thesaurus sections may be confused
- State transitions need debugging
- Tab structure handling incomplete

### Next Steps

1. Debug state machine transitions with detailed logging
2. Verify `.dxr` vs `.tvr` container handling
3. Test with simpler entries first (single definitions)
4. Add unit tests for state transitions
5. Handle pronunciation (IPA) extraction
6. Implement thesaurus data extraction
7. Extract etymology/origin when present
8. Extract quotations when present

### Recommendation

Complete and verify a simpler dictionary first (like EE-3th) to gain experience with monolingual parsing, then return to 2015 parser with lessons learned.

---

## HTML Classes Reference

### Top-level Structure

| Class | Purpose |
|-------|---------|
| `.c1a` | Main container |
| `.fvv` | Tab interface container |
| `.dzf` | Dictionary tab label |
| `.t3h` | Thesaurus tab label |
| `.dxr` | Dictionary content wrapper |
| `.tvr` | Thesaurus content wrapper |

### Dictionary Section

| Class | Purpose |
|-------|---------|
| `.j84` | Entry block |
| `.quf` | Headword with pronunciation |
| `.f9d` | Simple headword |
| `.kf5` | IPA pronunciation |
| `.mh1` | Main content container |
| `.x5z` | POS section |
| `.jnw` | POS header |
| `.sg0` | POS label |
| `.oyu` | Definitions list |
| `.iji` | Definition item |
| `.sd9` | Definition text |
| `.k75` | Example arrow (⇒) |
| `.u9w` | Example text |
| `.roj` | Origin/etymology section |

### Thesaurus Section

| Class | Purpose |
|-------|---------|
| `.xf7` | Thesaurus container |
| `.fxr` | Synonym/antonym group |
| `.aox` | Group label |

*(More classes to be documented as parser develops)*

---

## Key Challenges

### 1. Dictionary vs Thesaurus Separation

**Challenge**: Both sections exist in the same HTML, need to parse separately

**Approach**:
- Track state: `IN_DICTIONARY` vs `IN_THESAURUS`
- Parse `.dxr` content for definitions
- Parse `.tvr` content for synonyms/antonyms
- Keep data in separate structures

### 2. Thesaurus Data Alignment

**Challenge**: Thesaurus groups don't map 1:1 to definitions

**Solution**:
- Store thesaurus at entry level, not per-definition
- Group by POS within thesaurus object
- Allow multiple sense groups per POS

### 3. Optional Fields

**Challenge**: Not all entries have IPA, origin, quotes

**Solution**:
- Make all new fields optional in JSON schema
- Only include fields when data exists
- Handle missing data gracefully in parser

### 4. Entry Size

**Challenge**: 190k entries will take significant time to parse

**Solution**:
- Use streaming parser architecture (already in place)
- Process in batches
- Consider parallel processing for production conversion

---

## Testing Strategy

### Phase 1: Basic Structure (Current)

- [x] Load MDX file
- [x] Access entries
- [ ] Parse simple entries (no thesaurus)
- [ ] Extract headword
- [ ] Extract POS
- [ ] Extract definitions
- [ ] Extract examples

### Phase 2: Extended Fields

- [ ] Extract IPA pronunciation
- [ ] Extract origin/etymology
- [ ] Extract quotations
- [ ] Handle missing optional fields

### Phase 3: Thesaurus

- [ ] Identify thesaurus section
- [ ] Parse synonym groups
- [ ] Parse antonym groups
- [ ] Group by POS
- [ ] Handle multiple sense groups

### Phase 4: Validation

- [ ] Verify data completeness
- [ ] Check dictionary vs thesaurus split
- [ ] Validate JSON structure
- [ ] Sample quality checks

### Phase 5: Full Conversion

- [ ] Convert all 190k entries
- [ ] Performance optimization
- [ ] Error handling
- [ ] Output validation

---

## Sample Commands

### Extract Single Entry

```bash
node -e "
  const {MDX} = require('js-mdict');
  const mdx = new MDX('/Users/warits/code/ls100/server/lib/collins/Collins English Dictionary and Thesaurus, 2015.mdx');
  const result = mdx.lookup('ability');
  console.log(result.definition);
"
```

### Test Parser (When Ready)

```bash
cd /Users/warits/code/ls100/research/mdict
./convert-v2.js "/Users/warits/code/ls100/server/lib/collins/Collins English Dictionary and Thesaurus, 2015.mdx" \
  --parser=2015 \
  --start=ability \
  -c 100 \
  -o Collins-EDnT-2015/samples/test-100.json
```

---

## Files

```
Collins-EDnT-2015/
├── findings.md         # This file
├── parser-2015.js      # Parser implementation (WIP)
└── samples/            # Sample outputs (when ready)
```

---

## Comparison with ECE

| Feature | ECE | 2015 |
|---------|-----|------|
| Entries | 36,330 | 190,727 |
| Language | Bilingual | Monolingual |
| Chinese text | ✅ Yes | ❌ No |
| IPA pronunciation | ❌ No | ✅ Yes |
| Thesaurus | ❌ No | ✅ Yes |
| Etymology | ❌ No | ✅ Yes |
| Quotations | ❌ No | ✅ Yes |
| Parser status | ✅ Complete | ⚠️ In progress |

---

## Next Actions

1. ⏳ Debug basic definition extraction
2. ⏳ Test with 10-100 simple entries
3. ⏳ Add IPA extraction
4. ⏳ Add thesaurus extraction
5. ⏳ Add origin/quotes extraction
6. ⏳ Full validation
7. ⏳ Performance optimization
8. ⏳ Full conversion (190k entries)

**Priority**: Medium (ECE is the immediate focus)

**Estimated Effort**: 2-3x ECE complexity due to dual content and larger size

