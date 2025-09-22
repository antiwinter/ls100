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

// Format FSRS interval in days to human readable format (5m, 2h, 3d, 2mo, 1y)
export const formatInterval = (days) => {
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60)
    return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`
  } else if (days < 30) {
    return `${Math.round(days)}d`
  } else if (days < 365) {
    return `${Math.round(days / 30)}mo`
  } else {
    return `${Math.round(days / 365)}y`
  }
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
