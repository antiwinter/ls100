# First things first
* don't implement uncessary methods for a module, focus on the ones we need. entites should not be multipled uncessarily
* don't implement duplicated code, extract to a reusable function (or even separate module/file) when ever possible.
* we don't need Legacy aliases for backward compatibility, in this dev phase, just always make the code clean, clean and clean
* for complex modifications, always output plan for confirmation first, do not modify code directly


# JS things
* use yarn instead of npm
* use js (esm style) instead of ts if possible
* prefer short var/func names to long. e.g. db better then dbModule
* take advantage of object member names to eliminate intermediate variables. e.g. instead of `fooBar = 5; a = {foo: fooBar}` use `foo = 5; a = {foo}`

# Logging
* Backend: use `import { log } from '../utils/logger.js'` (Pino with auto file detection + user context)
* Frontend: use `import { log } from '../utils/logger'` (loglevel with env-based levels)
* No manual component labels - browser/server shows file names automatically
* http is auto logged by morgan, so no need manual logging
* prefers oneline logging for objects instead of multiline

# React Performance
* **Minimum dependencies**: Only include what actually changes behavior in useEffect/useCallback deps
* **useRef for mutable state**: Use refs instead of state when no re-render needed (e.g. selections, DOM refs)
* **useCallback only when needed**: Only use when passing to memoized components or other hook deps
* **Stable callbacks**: Use ref pattern `useRef(callback)` + `ref.current = callback` to avoid stale closures
* **memo with purpose**: Only memo components that receive stable props and have expensive renders
* **Avoid new objects in render**: Create constants outside component or use refs for stable references
