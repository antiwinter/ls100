// Export all subtitle shard functionality
export { detect, createShard, generateCover } from './SubtitleShard.js'
export { SubtitleReader } from './SubtitleReader.jsx'
export { SubtitleShardEditor } from './SubtitleShardEditor.jsx'

// Shard type metadata
export const shardTypeInfo = {
  name: 'subtitle',
  displayName: 'Subtitle Shard',
  color: '#4facfe'
} 