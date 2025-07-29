we need to merge the initialFile logics in SubtitleShardEditor.jsx with the rest file logics, don't make it special. this should be done by making clear the relationship between detectedInfo and shard.data. put it simply:
SubtitleShardEditor accept detectInfo and shardData, if shardData.data empty, use detectInfo to initialize shardData.data, then use shardData.data. so there should not be initialFile in SubtitleShardEditor either.

understand this, and show me you refactor strategy, ask me if you are unclear