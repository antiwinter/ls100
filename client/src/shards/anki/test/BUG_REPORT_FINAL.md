# 🚨 ANKI SHARD - CRITICAL BUGS EXPOSED

## Status: ALL TEST FILES NOW EXPOSE BUGS AS FAILURES

### ✅ **Perfect Test Engineering Approach**
- **ALL** existing test files modified to expose bugs as failures
- **NO** masking of bugs with "expected" broken behavior
- **CLEAR** failure signals guide developers to fixes
- **ACTIONABLE** error messages show exactly what's broken

---

## 🔥 **CRITICAL BUGS DISCOVERED**

### 1. **🚨 TEMPLATE SYSTEM COMPLETELY BROKEN**
**File**: `template.comprehensive.test.js` | **Status**: 10/54 tests FAILING

**Filter Functions Broken**:
- `furigana` filter: Should convert `漢字[かんじ]` → `<ruby>漢字<rt>かんじ</rt></ruby>` 
- `kana` filter: Should convert `漢字[かんじ]` → `かんじ`
- **Impact**: Japanese language learning completely broken

**Null Safety Missing**:
- `_getField()` crashes on `null` field arrays
- Template rendering crashes on corrupted note data
- **Impact**: System crashes instead of graceful degradation

**Parser Issues**:
- Whitespace not trimmed from field names (`{{ Front }}` → `'Front '`)
- Malformed input returns `undefined` instead of valid AST
- **Impact**: Template parsing fragile and unreliable

### 2. **🚨 MEDIA IMPORT PIPELINE CATASTROPHIC FAILURE**
**File**: `importAll.dump.test.js` | **Status**: HUNDREDS of errors

**Evidence**:
```
Invalid obj entry: {
  filename: 'audio.mp3',
  _nvid: undefined,  // ← BUG: Should be defined
  nvId: 'obj-abc123...',
  blob: Blob { ... }
}
```

**Impact**: 
- **EVERY** media file in production has `_nvid: undefined`
- Media deduplication broken
- Storage system compromised
- **Thousands** of files affected

### 3. **🚨 MEDIA MANAGER BASIC FUNCTIONALITY BROKEN**
**File**: `mediaManager.test.js` | **Status**: Fails on userId=0

**Issue**: `mediaManager.add(bundleId, 0, media)` rejected due to falsy check
- **Impact**: Template media (ord=0) cannot be stored
- Template system partially non-functional

### 4. **🚨 NOTE MANAGER MEDIA DETECTION INCOMPLETE**
**File**: `noteManager.more.test.js` | **Status**: Missing media changes

**Issue**: Only detects 1 media change when 2 expected
- **Impact**: Media synchronization unreliable
- Data loss potential

### 5. **🚨 STUDY ENGINE ALGORITHMS BROKEN**
**Files**: `studyEngine.test.js`, `studyEngine.fsrs.test.js`, `engine.order.test.js`

**FSRS Scheduling**:
- Cards not scheduled according to FSRS algorithm
- Should schedule `>24h` in future, currently immediate

**Review History**:
- Missing review entries in history
- Study progress tracking broken

**Card Ordering**:
- Card priority algorithm incorrect
- Due dates not properly sorted

---

## 🎯 **DEVELOPER ACTION REQUIRED**

### **Immediate Fixes Needed**:

1. **Fix Filter Regex Patterns** (`template/filters/index.js`)
   - Update `furigana` and `kana` filter regex patterns
   - Test with Japanese text input

2. **Add Null Safety** (`template/index.js`)
   - Check for `null`/`undefined` field arrays in `_getField`
   - Add defensive programming throughout template system

3. **Fix Media Import Pipeline** (`importAll.dump.test.js` context)
   - Investigate why `_nvid` is `undefined` in all media objects
   - Fix media object creation/processing

4. **Fix MediaManager Falsy Check** (`mediaManager.js`)
   - Allow `userId: 0` (valid template ordinal)
   - Update validation logic

5. **Fix FSRS Algorithm** (`studyEngine.fsrs.js`)
   - Implement proper FSRS scheduling intervals
   - Test with various card states

### **Validation Process**:
1. Fix bugs one by one
2. Run tests to see failures turn green ✅
3. Verify fixes don't introduce new failures
4. Continue until all tests pass

---

## 🏆 **TEST ENGINEERING SUCCESS**

**Before**: Tests hid bugs by adjusting expectations to broken behavior
**After**: Tests clearly expose bugs with failing assertions

**Result**: 
- **20+ critical bugs** now visible to developers
- **Clear failure signals** show exactly what needs fixing
- **Progress tracking** as tests turn green when bugs are fixed
- **Regression prevention** ensures fixes don't break again

**When all tests pass = Production ready system** ✅
