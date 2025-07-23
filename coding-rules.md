# First things first
* don't implement uncessary methods for a module, focus on the ones we need. entites should not be multipled uncessarily
* don't implement duplicated code, extract to a reusable function (or even separate module/file) when ever possible.

# JS things
* use yarn instead of npm
* use js (esm style) instead of ts if possible
* prefer short var/func names to long. e.g. db better then dbModule
* take advantage of object member names to eliminate intermediate variables. e.g. instead of `fooBar = 5; a = {foo: fooBar}` use `foo = 5; a = {foo}`
* use console.debug for verbose or debugging logs
