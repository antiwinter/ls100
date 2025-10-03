import { APP } from '../config/constants'

/**
 * Parse version and build info into display-ready format with badge color
 *
 * @returns {{ version: string, buildInfo: string, badgeColor: string }}
 */
export function getVersionInfo() {
  const { version, build: buildId, branch } = APP

  if (!buildId) {
    return { version, buildInfo: '', badgeColor: 'neutral' }
  }

  // Red: dirty (uncommitted changes)
  if (buildId.includes('-dirty')) {
    // Extract short commit hash from various formats:
    // - rev@c0.2.3-s0.8.3-187-g7839d92-dirty → g7839d92
    // - v0.2.3-2-ga1b2c3d-dirty → ga1b2c3d
    // - a1b2c3d-dirty → a1b2c3d
    const match = buildId.match(/-g([a-f0-9]+)-dirty$|^([a-f0-9]+)-dirty$/)
    const commitHash = match ? (match[1] || match[2]) : buildId.replace('-dirty', '')
    const branchPrefix = branch && branch !== 'main' ? `${branch}-` : ''
    return {
      version,
      buildInfo: `${branchPrefix}g${commitHash}-dirty`,
      badgeColor: 'danger'
    }
  }

  // Green: on a rev@ tag (clean release)
  if (buildId.startsWith('rev@')) {
    return {
      version,
      buildInfo: buildId, // e.g., rev@c0.2.3-s0.8.3-ga1b2c3d
      badgeColor: 'success'
    }
  }

  // Blue: clean but not released
  // Extract short commit hash for cleaner display
  // - v0.2.3-2-ga1b2c3d → ga1b2c3d
  // - a1b2c3d → ga1b2c3d
  const match = buildId.match(/-g([a-f0-9]+)$|^([a-f0-9]+)$/)
  const commitHash = match ? (match[1] || match[2]) : buildId
  const branchPrefix = branch && branch !== 'main' ? `${branch}-` : ''
  return {
    version,
    buildInfo: `${branchPrefix}g${commitHash}`,
    badgeColor: 'primary'
  }
}

export default getVersionInfo

