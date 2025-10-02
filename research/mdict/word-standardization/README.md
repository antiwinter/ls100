# Word Standardization Research

Research on standardizing inflected words (plurals, past tense, -ing, possessive, etc.) for dictionary lookup.

## Quick Summary

**Problem**: Users select inflected words (e.g., "running", "books", "children's") that may not be found in dictionaries.

**Solution**: Use `wink-lemmatizer` to standardize words before lookup.

**Results**: 95.5-99.1% success rate (vs 47.3-81.3% without standardization)

## Files

- **`WORD_STANDARDIZATION.md`** - Full research report with detailed results and tables
- **`RESEARCH_SUMMARY.txt`** - Quick summary of findings and recommendations
- **`test-word-standardization.js`** - Research test script (112 test words, 3 approaches)
- **`word-standardizer.js`** - Reusable utility function with caching
- **`example-standardizer.js`** - Usage demo and performance test

## Usage

```bash
# Run the full research test
node test-word-standardization.js

# See usage example
node example-standardizer.js
```

## Quick Start

```javascript
import { standardizeWord } from './word-standardizer.js'

const word = standardizeWord('running')  // 'run'
const word2 = standardizeWord('children') // 'child'
const word3 = standardizeWord("book's")  // 'book'
```

## Key Findings

| Method | ECE | Collins 2015 |
|--------|-----|--------------|
| Direct lookup | 47.3% | 81.3% |
| Simple rules | 75.9% | 77.7% ⚠️ |
| **wink-lemmatizer** | **95.5%** ✅ | **99.1%** ✅ |

## Dependencies

- `wink-lemmatizer` (v3.0.4) - ~500KB, already installed in parent directory

## Next Steps

Integrate `word-standardizer.js` into the main dictionary lookup flow.

