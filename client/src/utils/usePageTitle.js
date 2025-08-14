import { useEffect } from 'react'
import { APP } from '../config/constants'

/**
 * Custom hook to manage page titles dynamically using centralized config
 * @param {string} pageTitle - Optional page-specific title (e.g., "Edit Shard")
 * @param {string} description - Optional page-specific description
 */
export const usePageTitle = (pageTitle = '', description = '') => {
  useEffect(() => {
    // Set title with inline helper logic
    document.title = pageTitle
      ? `${pageTitle} | ${APP.short}`
      : APP.name

    // Update meta description if provided
    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', description)
      }
    }

    // Cleanup: reset to default when component unmounts
    return () => {
      if (pageTitle) {
        document.title = APP.name
        const metaDescription = document.querySelector('meta[name="description"]')
        if (metaDescription) {
          metaDescription.setAttribute('content', APP.desc)
        }
      }
    }
  }, [pageTitle, description])
}

export default usePageTitle
