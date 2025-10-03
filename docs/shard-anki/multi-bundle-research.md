# Multi-Bundle Research: Anki Note Types Analysis

## Research Question

When importing .apkg files, should we support multiple note types (bundles) per shard, or simplify to single bundle per shard?

## Background

In Anki architecture:
- **Note Type** (aka Model) = Content structure definition (fields + templates)
- **Bundle** (ls100 term) = Our equivalent of note type
- One .apkg file can contain **multiple note types**
- Each note type can have different:
  - Field definitions (number and names)
  - Templates (card generation rules)
  - CSS styling

## Test Data Analysis

### Note Type Distribution

Analyzed 10 real .apkg files from test data:

```
Single note type (majority):
- Ultimate Geography [ZH]: 1 note type
- Core 2000: 1 note type
- Rubik's Cube PLL: 1 note type
- Rubik's Cube OLL: 1 note type
- Major System: 1 note type
- 2x2 PBL: 1 note type

Multiple note types (minority):
- HoldEmStartingHands: 3 note types
- Rubiks_Cube_2-Sided_PLL_Recognition: 2 note types
- db-snapshot (multi-deck export): 11 note types
```

**Finding:** ~70% of .apkg files contain only 1 note type.

### Multiple Note Types Example

**HoldEmStartingHands.apkg** (3 note types):
```javascript
Note Type "Basic" (ID: 1342700321028):
  Fields: ["Front", "Back"]
  Template: "Forward"
  Notes: 169 ✅ (ALL DATA HERE)

Note Type "Cloze" (ID: 1345895492874):
  Fields: ["Text", "Extra"]
  Template: "Cloze"
  Notes: 0 ❌ (EMPTY)

Note Type "Basic" (ID: 1345895492875):
  Fields: ["Front", "Back"]
  Template: "Card 1"
  Notes: 0 ❌ (EMPTY)
```

**Rubiks_Cube_2-Sided_PLL_Recognition.apkg** (2 note types):
```javascript
Note Type "Basic-c9521" (ID: 1599113433399):
  Fields: ["Front", "Back"]
  Notes: 71 ✅ (ALL DATA HERE)

Note Type "Basic" (ID: 1612525333261):
  Fields: ["Front", "Back"]
  Notes: 0 ❌ (EMPTY)
```

## Real-World Anki Behavior Verification

Tested imports in official Anki desktop app:

### Test 1: HoldEmStartingHands.apkg
- Browse shows all 169 notes in **"Basic+"** note type
- "Basic" and "Cloze" note types exist but are **empty** (0 notes)
- Name changed to "Basic+" due to conflict with existing "Basic" in collection

### Test 2: Rubiks_Cube_2-Sided_PLL_Recognition.apkg
- Browse shows all 71 notes in **"Basic-c9521"** note type
- "Basic" note type exists but is **empty** (0 notes)

**Note:** The "+" suffix is Anki's conflict resolution when importing note types with same name but different structure.

## Key Findings

### 1. Empty Note Types Are Common

**Why do .apkg files include empty note types?**
- **Creator's template library**: Available but unused note types
- **Historical artifacts**: Previously used, all notes deleted
- **Anki defaults**: Default note types included on deck creation
- **Export behavior**: Anki exports all note types even if unused

### 2. Field Definitions Vary

Different note types have **completely different** field structures:

```javascript
"Core 2000": 18 fields
  ["Optimized-Voc-Index", "Vocabulary-Kanji", ...]

"Ultimate Geography": 8 fields
  ["Country", "Capital", "Flag", "Map", ...]

"Basic": 2 fields
  ["Front", "Back"]
```

Even note types with **same fields** can differ in templates/styling.

### 3. Data Distribution

In files with multiple note types:
- **One note type contains 100% of data**
- Other note types are **empty placeholders**
- No tested .apkg file had notes distributed across multiple types

### 4. Current Implementation

Our `importApkgData()` already handles multiple note types:
```javascript
// Creates one bundle per note type
for (const [modelId, model] of Object.entries(bundles)) {
  const bundleId = genId('bundle', ...)
  bundleIds.push(bundleId)  // Returns array of all bundles
}
```

Returns: `{ bundleIds: ['bundle1', 'bundle2', ...] }`

## Single-Bundle Refactor Impact

### Proposed Change
```javascript
// Current: shard.meta.bundles = [{id, name}, {id, name}, ...]
// Proposed: shard.meta.bundleId = 'bundle-xyz'

// Implementation:
shard.meta.bundleId = result.bundleIds[0]  // Use first bundle only
```

### Impact Assessment

**✅ Works perfectly for:**
- 70% of .apkg files (single note type)
- 100% of tested multi-note-type files (others are empty)

**⚠️ Potential data loss:**
- Rare case: .apkg with notes distributed across multiple note types
- **No examples found in real-world test data**

### User Experience

Multi-note-type .apkg with populated types could be handled via:

**Option A: Import as separate shards**
```
User imports: Geography.apkg (with Basic + Cloze types)
Result: Creates two shards:
  - "Geography - Basic" shard
  - "Geography - Cloze" shard
```

**Option B: Merge note types**
- Combine all note types into one super-bundle
- Complex, requires field mapping and template merging

**Option C: Use first populated note type**
- Auto-detect which note type has notes
- Use that one, ignore empty types

## Conclusions

### 1. Multi-Bundle Support Justified

**Reasons to keep current multi-bundle architecture:**
- Handles edge cases (rare but possible)
- No implementation cost (already working)
- Future-proof for cross-bundle features
- Matches Anki's actual architecture

### 2. Empty Note Types Are Normal

**Decision:** Keep importing all note types, even empty ones.
- No storage cost (empty note types are ~100 bytes)
- Preserves deck structure for potential future use
- Matches user's original Anki collection

### 3. Single-Bundle Refactor Not Recommended

**Risk vs Reward:**
- Risk: Data loss on rare multi-populated-type imports
- Reward: Slightly simpler code (~50 lines less)
- **Conclusion:** Not worth the risk

### 4. Current Reader Implementation

AnkiReader already uses only first bundle:
```javascript
const firstBundleId = shard?.meta?.bundles?.[0]?.id
```

**Recommendation:** This is fine for MVP. Future enhancement could:
- Show bundle selector in UI
- Allow switching between bundles in same shard
- Study cards from multiple bundles together

## Recommendations

### Short Term
- ✅ Keep current multi-bundle architecture
- ✅ Continue using first bundle in reader (covers 100% of test cases)
- ✅ Add bundle count to shard info display

### Future Enhancements
- [ ] UI to select which bundle to study
- [ ] "Study all bundles" mode
- [ ] Detect and warn about empty note types on import
- [ ] Option to filter out empty note types during import

## Related Files

- `client/src/shards/anki/AnkiShard.js` - processData() handles multiple bundles
- `client/src/shards/anki/apkg/import.js` - importApkgData() creates bundles
- `client/src/shards/anki/reader/AnkiReader.jsx` - Uses bundles[0]
- `client/src/shards/anki/core/index.js` - getCardsForBundles() supports array

## Test Data

Location: `client/src/shards/anki/test/parsed/*.json`

Key files for multi-bundle testing:
- `HoldEmStartingHands.json` - 3 note types (1 populated, 2 empty)
- `Rubiks_Cube_2-Sided_PLL_Recognition.json` - 2 note types (1 populated, 1 empty)
- `db-snapshot.json` - 11 note types (multi-deck export)

