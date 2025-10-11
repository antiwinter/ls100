# First things first
* don't implement uncessary methods for a module, focus on the ones we need. entites should not be multipled uncessarily
* don't implement duplicated code, extract to a reusable function (or even separate module/file) when ever possible.
* we don't need Legacy aliases for backward compatibility, in this dev phase, just always make the code clean, clean and clean
* for complex modifications, always output plan for confirmation first, do not modify code directly


# JS things
* use yarn instead of npm
* use yarn lint to check lint error
* use js (esm style) instead of ts if possible
* prefer short var/func names to long. e.g. db better then dbModule
* take advantage of object member names to eliminate intermediate variables. e.g. instead of `fooBar = 5; a = {foo: fooBar}` use `foo = 5; a = {foo}`
* suggest/use sophisticated package for specific tasks, such as protobuf decoding, instead of trying to build from scratch

# CSS
* use JOY color names instead of hard code

# Logging
* Backend: use `import { log } from '../utils/logger.js'` (Pino with auto file detection + user context)
* Frontend: use `import { log } from '../utils/logger'` (loglevel with env-based levels)
* No manual component labels - browser/server shows file names automatically
* http is auto logged by morgan, so no need manual logging
* prefers oneline logging for objects instead of multiline


# Error Handling
* aggregate error management to one place instead of scattered setState calls
* in async effects, only set error state once in catch block
* avoid resetting all state fields redundantly - only set what needs to change

# State Management
* augment data in place during load - add computed fields directly to objects before setState
* use lodash `_.keyBy()` to convert arrays to objects for fast lookup
* **don't put state in its own effect dependencies** - causes infinite loops
* setState for filtered/searched results when you need the array for rendering

# Async Patterns
* **await first, then .map()** - can't call array methods on promises: `(await getData()).map(...)` not `await getData().map(...)`
* use lodash for cleaner data transformations

# React Patterns
* **Clean up side effects** - style tags, event listeners, timers must be removed in useEffect cleanup
* **Don't use JSX for `<style>` tags** - they persist after unmount, use useEffect to manage lifecycle

# Examples 1:
SHIT:
```javascript
export const engineGetReader = (shardType, mode) => {
  const readerComponents = engine?.ReaderComponent
  if (!readerComponents) return null
  if (typeof readerComponents === 'object' && !readerComponents.$$typeof) {
    return readerComponents[mode] ||
           readerComponents.default ||
           readerComponents.view ||
           Object.values(readerComponents)[0] ||
           null
}
```

GOOD:
```javascript
export const engineGetReader = (shardType, mode) => {
  const RC = getEngine(shardType)?.ReaderComponent
  return RC?.[mode] || RC?.default
}
```

# Examples 2: Error handling in async effects
SHIT:
```javascript
try {
  const data = await fetchData()
  if (!data) {
    if (alive) {
      setState1([])
      setState2(new Map())
      setState3('error')
      setState4('')
    }
    return
  }
  // ... more similar scattered error handling
} catch (err) {
  if (alive) {
    setState1([])
    setState2(new Map())
    setState3('error')
    setState4('')
  }
}
```

GOOD:
```javascript
try {
  const _data = await fetchData()
  if (!_data) throw new Error('No data')
  
  if (alive) {
    setState1(_data)
    setState2(processed)
    setState3(result)
  }
} catch (err) {
  log.error('Failed to load:', err)
  if (alive) setRenderer('error') // Single point of error state
}
```

# Examples 3: Style tag cleanup
SHIT:
```javascript
// ❌ Style persists after component unmounts - CSS pollution!
return (
  <Box>
    {renderer?.css && <style>{renderer.css}</style>}
    <Content />
  </Box>
)
```

GOOD:
```javascript
// ✅ Cleanup on unmount
useEffect(() => {
  if (!css) return
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  return () => style.remove()
}, [css])

return (
  <Box>
    <Content />
  </Box>
)
```
