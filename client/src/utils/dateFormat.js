import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
dayjs.extend(duration)

// Format seconds to time string (HH:MM:SS or MM:SS)
export const formatSec = s => {
  const d = dayjs.duration(s, 'seconds')
  return [d.hours(), d.minutes(), d.seconds()]
    .filter((v, i) => v !== 0 || i > 0)       // drop leading zero hours
    .map((v, i) => !i ? v : String(v).padStart(2, '0'))
    .join(':')
}

// Format interval from milliseconds to human readable format (<1m, 1.5mo, 2.3d style)
export const formatIntervalMs = (ms) => {
  let value, unit

  if (ms < 60000) { // < 1 minute
    return '<1m'
  } else if (ms < 3600000) { // < 1 hour
    value = ms / 60000
    unit = 'm'
  } else if (ms < 86400000) { // < 1 day
    value = ms / 3600000
    unit = 'h'
  } else if (ms < 2592000000) { // < 30 days
    value = ms / 86400000
    unit = 'd'
  } else if (ms < 31536000000) { // < 365 days
    value = ms / 2592000000
    unit = 'mo'
  } else {
    value = ms / 31536000000
    unit = 'y'
  }

  // Convert to 1 decimal place, then eliminate .0 with regex
  return value.toFixed(1).replace(/\.0$/, '') + unit
}

// Human-readable relative time formatting
export const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Unknown date'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return 'Invalid date'
  }

  // Future dates (shouldn't happen but handle gracefully)
  if (diffMs < 0) {
    return 'In the future'
  }

  // Less than 1 minute
  if (diffSeconds < 60) {
    return 'Just now'
  }

  // Less than 1 hour
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 min ago' : `${diffMinutes} mins ago`
  }

  // Less than 1 day
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }

  // Less than 1 week
  if (diffDays < 7) {
    return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`
  }

  // Less than 1 month
  if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`
  }

  // Less than 1 year
  if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`
  }

  // 1 year or more
  if (diffYears === 1) {
    return '1 year ago'
  } else if (diffYears < 5) {
    return `${diffYears} years ago`
  } else {
    return 'Long ago'
  }
}
