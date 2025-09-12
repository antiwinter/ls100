// Core Anki functionality exports - direct function exports only
export {
  addTemplate,
  getTemplates,
  removeTemplate,
  getBundle,
  getCardsForBundles,
  removeBundles,
  addBundle
} from './api.js'

export {
  create,
  get,
  update,
  deleteNote as delete
} from './noteManager.js'

export {
  render
} from './renderDefault.js'

export {
  addMedia,
  removeMedia,
  retainMedia,
  replaceMediaUrls,
  getBundlesMediaStats,
  getMediaStatsForBundles,
  removeBundlesMedia,
  clearCache
} from './mediaManager.js'

export { StudyEngine } from './studyEngine.js'
// db is internal to core - use api functions for external access
