# Documentation Rules

* check against relavant code before writing any sections of docs
* README.md focus on usage
* plan.md focus on plan, phase, todo, progress, etc.
* design.md focus on architecture, high level design
* during dev, we restructure plan.md frequently, when a design goes into detail, we extract it out, save to a separate file. of course, we can link it in plan.md
* these separate files are for modules or specific features, etc.

## Module-Level Documentation
1. prefer module level, e.g. shard.md should contain its api and db tables. if there indeed is a global db/api notation requirement, put it in design.md
2. no global db/api doc, as this buried the seed that will grow quite complex
3. use simple module/feature names, such as shard.md, dictionary.md, etc. not preferring xxx-design.md or xxx-arch.md, unless really necessary
