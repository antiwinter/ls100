# get cover preview back
_Exported on 7/29/2025 at 20:04:00 GMT+8 from Cursor (1.2.4)_

---

**User**

read @design.md to have a basic understanding of this project. then check git show (last commit) that a cover preview section is removed from subtitle shard engine (correct), but I didn't see it added elsewhere. correct logic should be:
the preview section in EditShard.jsx, it display the shard.cover url or call engineGenCover for content
show me you understanding and tell me what we need to do

---

**Cursor**

I'll first read the design document to understand the project structure, then check the last commit to see what was removed, and finally examine the current code to understand what needs to be implemented.

Based on my analysis of the code and the git commit, I understand the issue clearly:

## My Understanding

**What was removed:** The cover preview section was removed from `SubtitleShardEditor.jsx` (lines 502-612 in the commit), which included:
- Cover preview display (90x100px)
- Custom cover upload functionality 
- Cover URL input functionality
- Generated cover fallback using engine-specific `generateCover()`

**What's missing:** The cover preview logic should have been moved to `EditShard.jsx` but wasn't. Currently, `EditShard.jsx` has:
- A `showCoverDialog` state but no actual dialog implementation
- No cover preview section
- No way to display or edit shard covers

**Correct Logic Required:** The preview section in `EditShard.jsx` should:
1. Display `shard.cover` URL if a custom cover exists
2. Call `engineGenCover(shard)` for dynamic content generation if no custom cover
3. Allow users to upload custom covers or set cover URLs
4. Be engine-agnostic (work for any shard type)

## What We Need to Do

I need to add to `EditShard.jsx`:

1. **Cover preview section** - showing either custom cover or generated cover
2. **Cover editing dialog** - for uploading images or setting URLs  
3. **Cover upload functionality** - handling file uploads
4. **Integration with `engineGenCover()`** - for dynamic cover generation
5. **Proper shard.cover handling** - saving custom covers to the shard data

The implementation should be type-agnostic so it works for any shard engine, not just subtitle shards.

Should I proceed with implementing this cover preview system in `EditShard.jsx`?

---

**User**

good, go. @coding-rules.md 

---

**Cursor**

I'll implement the cover preview system in `EditShard.jsx` following the coding rules. Let me add the cover preview section and dialog functionality.

[CODE BLOCK: javascriptreact | 58 lines]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascriptreact | ++0 --1]

[CODE BLOCK: javascript | ++0 --1]

## ✅ Implementation Complete

I've successfully implemented the cover preview system in `EditShard.jsx` as requested. Here's what was added:

### **Cover Preview Section**
- Added a 90x100px preview box in the main edit form
- Shows custom cover image if `shard.cover` exists
- Falls back to `engineGenCover(shard)` for dynamic generation
- Fully engine-agnostic - works with any shard type

### **Cover Management Dialog**
- Upload image functionality with file picker
- URL input for setting cover from web links  
- Reset button to remove custom cover and return to generated
- Clean, simple UI following existing patterns

### **Integration Points**
- Fixed `engineGenCover()` function in engines.js (was calling wrong method)
- Added cover file upload handling in save flow
- Added missing imports and state management
- Fixed Switch import in SubtitleShardEditor.jsx

### **Key Features**
✅ **Custom covers**: Upload files or paste URLs  
✅ **Generated covers**: Engine-specific dynamic generation  
✅ **Engine-agnostic**: Works for subtitle, future audio/image shards  
✅ **Clean code**: Short names, no duplicated logic per @coding-rules.md  
✅ **Consistent UI**: Matches existing design patterns  

The implementation correctly handles the logic you specified:
- Preview section displays `shard.cover` URL when available
- Calls `engineGenCover()` for content-based generation when no custom cover
- Seamlessly integrated into the existing EditShard workflow

Would you like me to test this implementation or make any adjustments to the cover preview functionality?

---

**User**

we use AppDialog, do you still need to import those Modal things?

---

**Cursor**

[CODE BLOCK: javascript | 15 lines]

[CODE BLOCK: javascript | 6 lines]

You're absolutely right! I imported Modal components but I'm using AppDialog throughout. Let me clean up those unused imports.

[CODE BLOCK: javascriptreact | ++0 --1]

Perfect! Removed the unused Modal imports since we're using `AppDialog` everywhere. Much cleaner code following the @coding-rules.md principle of not importing unnecessary modules.

