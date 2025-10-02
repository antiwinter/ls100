# Collins 2015 Parser Implementation Plan

## Phase 1: Foundation & Debug Setup

### 1.1 Create Debug Tools

**Scripts to create:**

1. **`extract-sample.js`** - Extract HTML for specific words
   ```bash
   node extract-sample.js ability happy love
   # Output: samples/ability.html, samples/happy.html, etc.
   ```

2. **`analyze-structure.js`** - Analyze HTML patterns
   - Count main containers (`.dxr`, `.tvr`, `.roj`, `.exq`)
   - Find all unique CSS classes
   - Report structure statistics

3. **`test-single.js`** - Test parser on single word
   ```bash
   node test-single.js ability
   # Shows: JSON output + unknown patterns + validation
   ```

### 1.2 Sample Word Selection

Choose test words with different characteristics:

| Word | Why |
|------|-----|
| `ability` | Complete: dict + thesaurus + origin + quotes |
| `happy` | Multiple POS, multiple thesaurus groups |
| `a` | Simple, article, minimal structure |
| `run` | Many definitions, complex |
| `love` | Noun + verb, thesaurus, quotes |

### 1.3 Success Criteria

- [ ] Extract 5 sample HTML files
- [ ] Document all CSS class patterns
- [ ] Identify all container structures
- [ ] Map HTML to JSON fields

---

## Phase 2: Parser Implementation (Iterative)

### 2.1 Iteration 1: Basic Dictionary Content

**Goal:** Extract `word`, `defs[].pos`, `defs[].en`

**Test:**
```bash
./convert-v2.js dict.mdx --parser=2015 --start=ability -c 5
```

**Success:** JSON has word + definitions with pos and en

**States needed:**
- `IN_DICT_ENTRY` → `IN_HEADWORD`
- `IN_DICT_ENTRY` → `IN_POS_SECTION`
- `IN_POS_SECTION` → `IN_DEFINITION`

### 2.2 Iteration 2: Examples

**Goal:** Extract `defs[].exs[]`

**Test:** Check `ability` has examples

**States needed:**
- `IN_DEFINITION` → `IN_EXAMPLE`

### 2.3 Iteration 3: IPA Pronunciation

**Goal:** Extract `ipa` field

**Look for:** `<span class="kf5">/əˈbɪlɪtɪ/</span>`

**Test:** `ability.ipa === "/əˈbɪlɪtɪ/"`

### 2.4 Iteration 4: Etymology/Origin

**Goal:** Extract `origin` field

**Look for:** `<div class="roj">` or similar origin marker

**Test:** Entry with origin has `origin` field populated

### 2.5 Iteration 5: Thesaurus Basic

**Goal:** Extract `thesaurus.noun[].syno[]`

**Look for:** `.tvr` container, synonym lists

**Test:** `happy.thesaurus.adjective[0].syno` contains synonyms

### 2.6 Iteration 6: Thesaurus Antonyms

**Goal:** Extract `thesaurus.noun[].anto[]`

**Test:** Entry has antonyms when in MDX

### 2.7 Iteration 7: Quotations

**Goal:** Extract `quotes[]`

**Look for:** Quote containers

**Test:** Entry with quotes has `quotes` array

### 2.8 Iteration 8: Cross-references

**Goal:** Extract `refTo[]`

**Test:** Flat array of referenced words

---

## Phase 3: Validation & Quality

### 3.1 Update JSON Validator

**Add checks for optional fields:**

```javascript
// validate-json.js additions
// 1. IPA format validation (if present)
if (entry.ipa && !/^\/[^\/]+\/$/.test(entry.ipa)) {
  issues.push({ word, reason: 'Invalid IPA format' })
}

// 2. Thesaurus structure validation
if (entry.thesaurus && Object.keys(entry.thesaurus).length > 0) {
  for (const pos in entry.thesaurus) {
    if (!Array.isArray(entry.thesaurus[pos])) {
      issues.push({ word, reason: 'Thesaurus POS not array' })
    }
  }
}

// 3. Origin validation
if (entry.origin && typeof entry.origin !== 'string') {
  issues.push({ word, reason: 'Origin not string' })
}

// 4. Quotes validation
if (entry.quotes && Array.isArray(entry.quotes)) {
  for (const quote of entry.quotes) {
    if (!quote.text || !quote.author) {
      issues.push({ word, reason: 'Invalid quote structure' })
    }
  }
}
```

### 3.2 Create 2015-Specific Validator

`Collins-EDnT-2015/validate-2015-vs-mdx.js`

**Checks:**
- IPA exists when in MDX
- Thesaurus section extracted when in MDX
- Origin extracted when in MDX
- Quotes extracted when in MDX

### 3.3 Quality Metrics

Run on sample (100-1000 entries):

- Success rate > 95%
- IPA coverage (when available)
- Thesaurus coverage (when available)
- Origin coverage (when available)
- Quotes coverage (when available)

---

## Phase 4: Documentation

### 4.1 Update CONVERTER.md

Add extended JSON format section:

```markdown
### Extended Fields (2015 Edition)

#### IPA Pronunciation
```json
{
  "word": "ability",
  "ipa": "/əˈbɪlɪtɪ/"
}
```

#### Thesaurus
```json
{
  "thesaurus": {
    "noun": [
      {
        "syno": ["capability", "capacity"],
        "anto": ["inability"]
      }
    ]
  }
}
```

#### Origin
```json
{
  "origin": "Old English abilite, from Latin habilitatem..."
}
```

#### Quotations
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
```

### 4.2 Update Findings

Document:
- Parser completeness
- Coverage statistics
- Known limitations
- Edge cases

---

## Phase 5: Full Conversion

### 5.1 Sample Conversion

```bash
./convert-v2.js dict.mdx --parser=2015 --start=a -c 1000 -o samples/1000.json
node validate-json.js samples/1000.json
```

**Expected:** 95%+ pass rate

### 5.2 Full Conversion

```bash
./convert-v2.js dict.mdx --parser=2015 -o collins-2015-full.json
```

**Expected:**
- 190,727 entries
- ~80-100 MB file size
- ~2-3 hours processing time

---

## Testing Strategy

### Unit Testing (Manual)

For each iteration:
1. Test on 1 word
2. Inspect JSON visually
3. Compare to MDX HTML
4. Fix issues
5. Test on 5-10 words
6. Check statistics

### Integration Testing

After each major milestone:
1. Convert 100 entries
2. Run validator
3. Check pass rate
4. Investigate failures
5. Update parser
6. Repeat

### Regression Testing

Before moving to next phase:
1. Re-test all previous test cases
2. Ensure no regressions
3. Update test suite

---

## Implementation Order

```
Phase 1: Setup (30 min)
  ├─ Create debug scripts
  ├─ Extract samples
  └─ Document structure

Phase 2: Parser (4-6 hours, iterative)
  ├─ Iteration 1: Basic dict (1h)
  ├─ Iteration 2: Examples (30min)
  ├─ Iteration 3: IPA (30min)
  ├─ Iteration 4: Origin (30min)
  ├─ Iteration 5: Thesaurus syno (1h)
  ├─ Iteration 6: Thesaurus anto (30min)
  ├─ Iteration 7: Quotes (30min)
  └─ Iteration 8: RefTo (30min)

Phase 3: Validation (1-2 hours)
  ├─ Update validator (30min)
  ├─ Create 2015 validator (30min)
  └─ Run quality checks (30min)

Phase 4: Documentation (1 hour)
  ├─ Update CONVERTER.md (30min)
  └─ Update findings (30min)

Phase 5: Full conversion (3 hours)
  └─ Run + validate full
```

**Total estimated time:** 10-13 hours

---

## Success Checklist

- [ ] All 5 sample words parse correctly
- [ ] Generic validator passes 100%
- [ ] 2015-specific validator passes 95%+
- [ ] IPA extracted when present
- [ ] Thesaurus extracted when present
- [ ] Origin extracted when present
- [ ] Quotes extracted when present
- [ ] Documentation complete
- [ ] Full conversion successful

---

## Risk Mitigation

### Risk 1: HTML complexity > ECE

**Mitigation:** Start simple, iterate, don't try to handle everything at once

### Risk 2: Thesaurus alignment issues

**Mitigation:** Store thesaurus separately at entry level (already designed)

### Risk 3: Unknown patterns

**Mitigation:** Report unknown patterns, investigate, update parser

### Risk 4: Performance

**Mitigation:** Use streaming architecture (already in place), test on samples first

---

## Next Steps

1. ✅ Create this plan
2. ⏳ Create debug scripts
3. ⏳ Extract samples
4. ⏳ Start Iteration 1
5. ⏳ Continue iteratively

