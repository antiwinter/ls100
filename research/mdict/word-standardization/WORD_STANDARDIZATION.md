# Word Standardization Research

## Problem

In real usage, users often select/click/paste words with suffixes (plurals, past tense, -ing, possessive, etc.), which may not be found directly in dictionaries.

## Test Methodology

1. Created 112 test words covering common inflections:
   - Plurals (18 words): books, children, people, knives, wives, etc.
   - Past tense (20 words): walked, went, made, stopped, etc.
   - Present continuous (20 words): walking, going, running, etc.
   - Third person singular (16 words): walks, goes, does, watches, etc.
   - Comparative/superlative (14 words): bigger, biggest, better, best, etc.
   - Possessive (6 words): book's, children's, people's, etc.
   - Adverbs (7 words): quickly, happily, carefully, etc.
   - Other prefixes/suffixes (11 words): unable, unhappy, reaction, etc.

2. Tested lookup in two dictionaries:
   - Collins-Advanced-ECE.mdx (~36k entries)
   - Collins English Dictionary and Thesaurus 2015 (~80k entries)

3. Compared three approaches:
   - Direct lookup (no standardization)
   - Simple rule-based standardization
   - wink-lemmatizer (proper lemmatization)

## Results

### Overall Success Rates

| Method | ECE | Collins 2015 |
|--------|-----|--------------|
| **Direct lookup** | 53/112 (47.3%) | 91/112 (81.3%) |
| **Simple rules** | 85/112 (75.9%) | 87/112 (77.7%) |
| **wink-lemmatizer** | **107/112 (95.5%)** | **111/112 (99.1%)** |

### Key Findings

1. **Collins 2015 has better inflection coverage**: Direct lookup finds 81.3% vs ECE's 47.3%

2. **Simple rules hurt Collins 2015**: The naive approach of stripping suffixes actually decreased Collins 2015 accuracy (from 81.3% to 77.7%) because it has many inflected forms as separate entries.

3. **wink-lemmatizer is highly effective**:
   - Improved ECE from 47.3% → **95.5%** (+54 words, +48.2 percentage points)
   - Improved Collins 2015 from 81.3% → **99.1%** (+20 words, +17.8 percentage points)
   - Only 5 words failed in ECE, 1 word failed in Collins 2015

4. **Failure analysis** (words not found even after lemmatization):
   - ECE failures: people, is, more, most, reaction
   - Collins 2015 failures: reaction
   - Note: "people" doesn't lemmatize to "person" in wink-lemmatizer

### Breakdown by Category

| Category | ECE Improvement | Collins 2015 Improvement |
|----------|-----------------|--------------------------|
| Plurals | 6 → 14 (+8) | 18 → 15 (-3) |
| Past tense | 10 → 11 (+1) | 17 → 11 (-6) |
| Present continuous | 13 → 15 (+2) | 18 → 15 (-3) |
| Third person | 3 → 15 (+12) | 9 → 15 (+6) |
| Comparative | 6 → 10 (+4) | 12 → 10 (-2) |
| Possessive | 0 → 5 (+5) | 0 → 6 (+6) |
| Adverbs | 4 → 4 (0) | 6 → 4 (-2) |
| Other | 11 → 11 (0) | 11 → 11 (0) |

(Note: These are for simple rules; wink-lemmatizer performed much better across all categories)

## Recommendations

### ✅ Recommended: wink-lemmatizer

**Library**: `wink-lemmatizer` (v3.0.4)

**Pros**:
- Small size (~500KB with dependencies)
- Fast performance
- 95-99% success rate
- Proper linguistic lemmatization
- Handles irregular verbs correctly (went → go, made → make)
- Handles irregular plurals correctly (children → child, knives → knife)

**Cons**:
- Requires npm package (~500KB)
- Some edge cases like "people" → "people" (doesn't convert to "person")

**Usage**:
```javascript
import lemmatizer from 'wink-lemmatizer'

function standardizeWord(word) {
  // Remove possessive 's first
  const cleaned = word.replace(/'s$/i, '').toLowerCase()
  
  // Try all forms and pick the shortest
  const candidates = [
    lemmatizer.noun(cleaned),
    lemmatizer.verb(cleaned),
    lemmatizer.adjective(cleaned)
  ].filter(w => w !== cleaned)
  
  return candidates.length > 0
    ? candidates.reduce((a, b) => a.length <= b.length ? a : b)
    : cleaned
}
```

### Alternative: Simple Rule-Based

If package size is critical and only ECE dictionary is used, a simple rule-based approach provides reasonable results (75.9% success rate).

**Pros**:
- No dependencies
- Very small code size
- Fast

**Cons**:
- Lower accuracy (75.9% vs 95.5%)
- Breaks Collins 2015 lookup (77.7% vs 81.3% direct)
- Many edge cases and incorrect transformations

**Not recommended** unless extreme constraints exist.

## Implementation Plan

1. Add `wink-lemmatizer` as a dependency
2. Create a `standardizeWord()` utility function
3. Apply standardization before dictionary lookup
4. Consider caching standardized forms for performance
5. Handle special cases (people → person, etc.) if needed

## Performance Considerations

- wink-lemmatizer is fast enough for real-time lookup
- Consider caching standardized forms to avoid repeated work
- The lookup time is dominated by dictionary access, not lemmatization

## Test Script

Run the full test:
```bash
cd research/mdict
node test-word-standardization.js
```

