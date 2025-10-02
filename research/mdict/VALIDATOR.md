# JSON Validator

Generic, parser-agnostic validator for dictionary conversion output.

---

## Purpose

The **golden rule** validator that all dictionary parsers must pass. It validates the JSON structure and content quality without comparing to source MDX/HTML.

**Key principles:**
- ✅ Parser-agnostic (works for any dictionary)
- ✅ Only checks JSON, no MDX/HTML dependencies
- ✅ Validates against our JSON standard
- ✅ Fast and portable

---

## Usage

```bash
node validate-json.js <path-to-json-file>
```

**Examples:**

```bash
# Validate ECE output
node validate-json.js Collins-Advanced-ECE/samples/1000.json

# Validate 2015 output (when ready)
node validate-json.js Collins-EDnT-2015/samples/test.json

# Validate any dictionary JSON
node validate-json.js path/to/dictionary.json
```

---

## Validation Checks

### 1. Basic Structure ✅

**What:** Valid JSON with required fields

**Checks:**
- Entry has `word` field (string)
- Entry has `defs` field (array)
- Each definition is an object

**Why:** Ensures minimum valid structure

### 2. POS Split ✅

**What:** Chinese characters should not be in English `pos` field

**Checks:**
- `def.pos` contains no Chinese characters (U+4E00-U+9FA5)
- Chinese POS should be in `def.posZh` (if present)

**Example:**
```json
// ✅ Correct
{"pos": "VERB", "posZh": "动词"}

// ❌ Wrong
{"pos": "VERB 动词"}
```

**Why:** Maintains clean separation of bilingual content

### 3. RefTo Format ✅

**What:** Cross-references should be flat string array

**Checks:**
- `refTo` is array of strings
- NOT array of objects with `phrases` property

**Example:**
```json
// ✅ Correct
"refTo": ["abandon", "abandonment"]

// ❌ Wrong
"refTo": [{"phrases": ["abandon"]}, {"phrases": ["abandonment"]}]
```

**Why:** Simpler data structure, easier to query

### 4. Labels Extracted ✅

**What:** No label markers left in JSON

**Checks:**
- No `】` characters anywhere in JSON
- Label patterns should be extracted to `labels[]` array

**Example:**
```json
// ✅ Correct
{
  "labels": ["FORMAL"],
  "en": "If you abandon something, you leave it..."
}

// ❌ Wrong
{
  "en": "【STYLE标签】：FORMAL 正式 If you abandon something..."
}
```

**Why:** Labels should be structured metadata, not embedded text

### 5. Statistics 📊

**What:** Reports useful metrics

**Provides:**
- Total entries validated
- Pass/fail counts and percentages
- Number of entries with labels
- Label coverage percentage

**Why:** Helps assess conversion quality and completeness

---

## Exit Codes

- **0**: All checks passed ✅
- **1**: One or more checks failed ❌

Use in CI/CD pipelines:
```bash
node validate-json.js output.json || exit 1
```

---

## Output Example

```
🧪 Validating JSON structure...

JSON: Collins-Advanced-ECE/samples/1000.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 VALIDATION RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total entries: 1000
✅ Passed: 1000 (100.0%)
❌ Failed: 0 (0.0%)

📈 STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entries with labels: 302 (30.2%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All checks passed!
```

---

## vs Parser-Specific Validators

### This Validator (Generic)

- ✅ Works for any dictionary
- ✅ No MDX/HTML dependencies
- ✅ Fast
- ✅ Portable
- ✅ Golden rule for all parsers

### Parser-Specific Validators

Example: `Collins-Advanced-ECE/validate-ece-vs-mdx.js`

- ⚠️ Development tool only
- ⚠️ Requires MDX access
- ⚠️ Parser-specific checks
- ⚠️ Compares JSON to source HTML
- ✅ Useful for parser debugging

**When to use which:**
- **This validator**: Final output quality check, CI/CD, production
- **Parser-specific**: Parser development, debugging, tuning

---

## Adding New Checks

When adding checks, ensure they are:

1. **Parser-agnostic**: Work for any dictionary format
2. **JSON-only**: No MDX/HTML dependencies
3. **Standard-based**: Check against our JSON standard
4. **Clear**: Good error messages with examples
5. **Fast**: No heavy processing

**Example of a good check:**
```javascript
// Check refTo format
if (entry.refTo && entry.refTo.length > 0) {
  if (typeof entry.refTo[0] === 'object') {
    issues.push({ word, reason: 'refTo should be string[]' })
  }
}
```

**Example of a bad check:**
```javascript
// DON'T: Parser-specific, MDX-dependent
const mdx = new MDX('specific-dictionary.mdx')
const html = mdx.lookup(word)
// ...compare JSON to HTML...
```

---

## Future Enhancements

Potential additions (while maintaining parser-agnostic nature):

- [ ] Check for duplicate entries
- [ ] Validate IPA format (when present)
- [ ] Check for malformed URLs in examples
- [ ] Validate array nesting depth
- [ ] Check for empty required fields
- [ ] Schema validation (JSON Schema)
- [ ] Performance benchmarks

---

## See Also

- `CONVERTER.md` - Converter architecture and usage
- `Collins-Advanced-ECE/findings.md` - ECE-specific documentation
- Individual parser files for parser-specific validation

