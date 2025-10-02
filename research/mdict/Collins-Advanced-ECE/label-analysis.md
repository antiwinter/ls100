# Dictionary Labels Analysis

## Overview

Found 6 types of metadata labels in 【】(Chinese brackets) format in the Collins ECE MDX:

| Label Type | Status | Description |
|------------|--------|-------------|
| 【语法信息】 | ✅ Extracted | Grammar patterns (extracted to POS field) |
| 【搭配模式】 | ✅ Removed | Collocation patterns (redundant, removed) |
| 【语用信息】 | ✅ Removed | Pragmatic info (removed) |
| 【STYLE标签】 | 📝 Kept | Style/register labels (formal, informal, etc.) |
| 【语域标签】 | 📝 Kept | Regional variant labels (British, American) |
| 【FIELD标签】 | 📝 Kept | Subject field labels (legal, business, etc.) |

### Processing Status

**Already Handled:**
- **【语法信息】**: Extracted to POS field (e.g., "VERB, V n, V-ed")
- **【搭配模式】**: Removed from definition text (collocation patterns)
- **【语用信息】**: Removed from definition text (pragmatic/usage info)

**Kept in Definition Text:**
- **【STYLE标签】**: 295 occurrences - useful context
- **【语域标签】**: 73 occurrences - regional information
- **【FIELD标签】**: 47 occurrences - subject area context

## Label Values

### 【STYLE标签】 - Style/Register (295 occurrences)

Values indicate the style or register of usage:

| Value | Count | Meaning |
|-------|-------|---------|
| FORMAL 正式 | 178 | Formal language |
| INFORMAL 非正式 | 38 | Informal language |
| LITERARY 文 | 31 | Literary language |
| WRITTEN 笔语 | 15 | Written language |
| OLD-FASHIONED 过时 | 15 | Old-fashioned |
| SPOKEN 口语 | 9 | Spoken language |
| TECHNICAL 术语 | 2 | Technical |
| HUMOROUS 幽默 | 2 | Humorous |
| DIALECT 方言 | 1 | Dialect |
| BUSINESS 商 | 1 | Business |
| *combinations* | 3 | e.g., "LITERARY or OLD-FASHIONED" |

**Examples:**
- "If you are abashed, you feel embarrassed and ashamed. 【STYLE标签】：WRITTEN 笔语"
- "Children who have learned their ABC... 【STYLE标签】：INFORMAL 非正式"

### 【语域标签】 - Regional Variants (73 occurrences)

Values indicate geographical usage:

| Value | Count | Meaning |
|-------|-------|---------|
| BRIT 英 | 37 | British English |
| AM 美 | 22 | American English |
| mainly AM 主美 | 8 | Mainly American |
| mainly BRIT 主英 | 6 | Mainly British |

**Examples:**
- "An abattoir is a place where animals are killed... 【语域标签】：BRIT 英"
- "In elections in the United States, if you vote by absentee ballot... 【语域标签】：AM 美"

### 【FIELD标签】 - Subject Fields (47 occurrences)

Values indicate specialized subject areas:

| Value | Count | Meaning |
|-------|-------|---------|
| BUSINESS 商 | 18 | Business |
| LEGAL 法律 | 9 | Legal |
| TECHNICAL 术语 | 7 | Technical |
| COMPUTING 计算机 | 5 | Computing |
| JOURNALISM 新闻 | 3 | Journalism |
| MEDICAL 医 | 1 | Medical |
| mainly JOURNALISM 主新闻 | 2 | Mainly journalism |
| *combinations* | 2 | e.g., "JOURNALISM or FORMAL" |

**Examples:**
- "If someone has no fixed abode, they are homeless. 【FIELD标签】：LEGAL 法律"
- "Access time is the time that is needed to get information... 【FIELD标签】：COMPUTING 计算机"

## Current Status

These labels are currently **embedded in the definition text** (`en` field).

## Proposed Structure

These metadata labels could be extracted to separate fields for better querying:

```json
{
  "word": "abashed",
  "defs": [
    {
      "pos": "ADJ",
      "posZh": "形容词",
      "en": "If you are abashed, you feel embarrassed and ashamed.",
      "zh": "害羞的；窘迫的；尴尬的",
      "style": "WRITTEN",       // extracted
      "styleZh": "笔语",         // extracted
      "exs": [...]
    }
  ]
}
```

Or for multiple labels:

```json
{
  "pos": "VERB",
  "posZh": "动词",
  "en": "To abet something, especially something bad or undesirable, means to make it possible.",
  "zh": "煽动；唆使；助长（坏事）",
  "field": "JOURNALISM or FORMAL",
  "fieldZh": "新闻或正式",
  "exs": [...]
}
```

## Recommendation

**Option 1: Keep as-is** (embedded in definition text)
- ✅ Simple, no parser changes needed
- ✅ Labels are contextual to the definition
- ❌ Harder to filter/query by style or field

**Option 2: Extract to separate fields**
- ✅ Better for filtering (e.g., show only formal definitions)
- ✅ Cleaner definition text
- ❌ Requires parser enhancement
- ❌ Adds complexity to data structure

**Current decision**: Keep embedded in definition text for now, as:
1. They're relatively rare (~415 total in 1000 entries)
2. They're part of the definition's meaning
3. The pattern is easy to extract later if needed

## Pattern for Future Extraction

If extraction is needed later:

```javascript
// Extract style label
const stylePattern = /【STYLE标签】[：:]\s*([^【]+)/
const match = def.en.match(stylePattern)
if (match) {
  def.style = match[1].trim()
  def.en = def.en.replace(stylePattern, '').trim()
}

// Similar for 【语域标签】 and 【FIELD标签】
```

## Statistics

In 1000-entry sample:
- **295 entries** (29.5%) have style labels
- **73 entries** (7.3%) have regional labels  
- **47 entries** (4.7%) have field labels
- Some entries have multiple label types

Total labeled content: ~35% of entries have at least one metadata label.

